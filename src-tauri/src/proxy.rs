//! CloseLabs Voice — cliente del proxy propio (Fase 1).
//!
//! Antes la app llevaba la llave de Groq incrustada y llamaba al proveedor directamente. Eso
//! tenía dos problemas: la llave es extraíble por cualquiera que tenga la app instalada, y
//! cambiar de proveedor obligaba a recompilar y reinstalar en el computador de cada médico.
//! Cuando Groq cerró su plan de pago, lo segundo pasó de incómodo a bloqueante.
//!
//! Ahora la app no conoce ninguna llave de proveedor. Manda el audio y el texto a nuestras Edge
//! Functions, que guardan las llaves y deciden a quién llamar leyendo una tabla. Cambiar de
//! proveedor es editar esa fila: las instalaciones obedecen en menos de un minuto.
//!
//! ⚠️ El audio del paciente sigue saliendo del equipo, ahora pasando por nuestro servidor. El
//! proxy no lo guarda: solo anota cuántos segundos duró. Sin internet, nada de esto corre y el
//! dictado se resuelve con el Parakeet local.

use std::time::Duration;

use log::{debug, info, warn};
use serde::Deserialize;
use tauri::AppHandle;

use crate::settings::{get_settings, write_settings};

/// Abrir la conexión. Si no hay internet, caer al motor local en 3 s y no en 60.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
/// El alta solo ocurre una vez y es un JSON diminuto.
const REGISTER_TIMEOUT: Duration = Duration::from_secs(10);
/// Tope del formateo, igual que el del servidor: pasado esto se pega el texto crudo.
const FORMAT_TIMEOUT: Duration = Duration::from_secs(15);

/// Tope de tiempo de una subida: base generosa más medio segundo por cada segundo de dictado,
/// porque subir por el internet de una clínica es lento. Con tope, para que un dictado largo no
/// deje al médico esperando sin final.
fn request_timeout(audio_seconds: f32) -> Duration {
    let secs = audio_seconds.max(0.0) as u64;
    Duration::from_secs((20 + secs / 2).min(120))
}

#[derive(Deserialize)]
struct RegisterResponse {
    token: String,
}

#[derive(Deserialize)]
struct TranscribeResponse {
    text: String,
    #[serde(default)]
    provider: String,
    /// El servidor avisa si mandó la pista del diccionario. Si es `false` teniendo diccionario,
    /// significa que el proveedor de turno no la soporta — útil para no adivinar cuando un
    /// médico reporta que "el diccionario no funciona".
    #[serde(default)]
    prompt_sent: bool,
}

#[derive(Deserialize)]
struct FormatResponse {
    text: String,
    #[serde(default)]
    provider: String,
}

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
}

fn client(timeout: Duration) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(timeout)
        .build()
        .map_err(|e| format!("cliente http: {e}"))
}

/// Lee el cuerpo de un error y devuelve el CÓDIGO que mandó el servidor (`rate_limit`,
/// `quota_exceeded`…). El proxy nunca devuelve el texto del proveedor, así que esto es seguro.
async fn error_code(res: reqwest::Response) -> String {
    let status = res.status();
    match res.json::<ErrorResponse>().await {
        Ok(e) => e.error,
        Err(_) => format!("http_{}", status.as_u16()),
    }
}

/// Token de esta instalación. La primera vez lo pide al servidor y lo guarda en los ajustes.
///
/// Devuelve `None` si no se pudo registrar (sin internet, servidor caído): el llamador cae al
/// motor local, igual que hacía antes cuando fallaba la nube.
pub async fn ensure_device_token(app: &AppHandle) -> Option<String> {
    let settings = get_settings(app);
    if let Some(token) = settings.device_token.clone().filter(|t| !t.is_empty()) {
        return Some(token);
    }

    let url = format!("{}/register", settings.proxy_base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "platform": std::env::consts::OS,
        "app_version": app.package_info().version.to_string(),
    });

    let res = client(REGISTER_TIMEOUT)
        .ok()?
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| warn!("No se pudo registrar la instalación: {e}"))
        .ok()?;

    if !res.status().is_success() {
        warn!("El registro devolvió {}", res.status());
        return None;
    }

    let token = res.json::<RegisterResponse>().await.ok()?.token;
    if token.is_empty() {
        return None;
    }

    // Se guarda de inmediato: si esto se pierde, la próxima vez se registra otra instalación y
    // las estadísticas contarían dos donde hay una.
    let mut updated = get_settings(app);
    updated.device_token = Some(token.clone());
    write_settings(app, updated);
    info!("Instalación registrada en el proxy de CloseLabs");
    Some(token)
}

/// Transcribe `audio` (ya codificado) con el proveedor que decida el servidor.
///
/// `filename` y `mime` describen el formato, para que el cliente conserve su cadena de respaldo
/// Opus → FLAC → WAV: si el proveedor de turno rechazara el formato, el servidor devuelve
/// `bad_request` y el llamador prueba el siguiente.
pub async fn transcribe(
    app: &AppHandle,
    audio: Vec<u8>,
    filename: &str,
    mime: &str,
    audio_seconds: f32,
    language: Option<&str>,
    prompt: Option<&str>,
) -> Result<String, String> {
    let settings = get_settings(app);
    let token = ensure_device_token(app)
        .await
        .ok_or_else(|| "sin token de instalación".to_string())?;

    let part = reqwest::multipart::Part::bytes(audio)
        .file_name(filename.to_string())
        .mime_str(mime)
        .map_err(|e| format!("mime: {e}"))?;
    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("audio_seconds", audio_seconds.to_string());
    if let Some(lang) = language {
        form = form.text("language", lang.to_string());
    }
    if let Some(p) = prompt {
        form = form.text("prompt", p.to_string());
    }

    let timeout = request_timeout(audio_seconds);
    let url = format!(
        "{}/transcribe",
        settings.proxy_base_url.trim_end_matches('/')
    );

    let res = client(timeout)?
        .post(&url)
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("proxy transcribe: {e}"))?;

    if !res.status().is_success() {
        return Err(error_code(res).await);
    }

    let body: TranscribeResponse = res
        .json()
        .await
        .map_err(|e| format!("respuesta del proxy: {e}"))?;

    if prompt.is_some() && !body.prompt_sent {
        // No es un error: el proveedor de turno no soporta pistas y el servidor la descartó a
        // propósito para no arriesgar una transcripción truncada. Queda en el log por si alguien
        // reporta que el diccionario dejó de corregir.
        debug!("El proveedor actual no acepta la pista del diccionario; se transcribió sin ella");
    }
    debug!(
        "Transcripción vía proxy OK ({} chars, proveedor {})",
        body.text.chars().count(),
        body.provider
    );
    Ok(body.text)
}

/// Limpia `text` con el formateador que decida el servidor.
pub async fn format(app: &AppHandle, text: &str, system_prompt: &str) -> Result<String, String> {
    let settings = get_settings(app);
    let token = ensure_device_token(app)
        .await
        .ok_or_else(|| "sin token de instalación".to_string())?;

    let url = format!("{}/format", settings.proxy_base_url.trim_end_matches('/'));
    let res = client(FORMAT_TIMEOUT)?
        .post(&url)
        .bearer_auth(&token)
        .json(&serde_json::json!({ "text": text, "system_prompt": system_prompt }))
        .send()
        .await
        .map_err(|e| format!("proxy format: {e}"))?;

    if !res.status().is_success() {
        return Err(error_code(res).await);
    }

    let body: FormatResponse = res
        .json()
        .await
        .map_err(|e| format!("respuesta del proxy: {e}"))?;
    debug!(
        "Formateo vía proxy OK ({} chars, proveedor {})",
        body.text.chars().count(),
        body.provider
    );
    Ok(body.text)
}

/// Transcribe `samples` subiendo **Opus** y, si el proveedor rechazara el formato, bajando a
/// FLAC y luego a WAV. Es la misma cadena de antes: comprimir agresivamente para el internet
/// lento de las clínicas, con WAV al final como garantía de no quedar peor que sin comprimir.
///
/// Solo se baja un escalón si la codificación falla o si el servidor responde `bad_request`.
/// Cualquier otro error (sin red, cupo agotado, el proveedor caído) corta la cadena: no tiene
/// sentido resubir el mismo audio por un problema que no es de formato.
pub async fn transcribe_with_fallback(
    app: &AppHandle,
    samples: &[f32],
    language: Option<&str>,
    prompt: Option<&str>,
) -> Result<String, String> {
    const IN_RATE: usize = 16_000;
    let audio_seconds = samples.len() as f32 / IN_RATE as f32;

    let mut last = "no se pudo codificar el audio en ningún formato".to_string();
    for format in crate::groq_transcribe::UPLOAD_FORMATS {
        let bytes = match (format.encode)(samples) {
            Ok(b) => b,
            Err(e) => {
                warn!("Falló codificar {} ({e}); siguiente formato", format.label);
                last = e;
                continue;
            }
        };
        let kb = bytes.len() / 1024;
        match transcribe(
            app,
            bytes,
            format.filename,
            format.mime,
            audio_seconds,
            language,
            prompt,
        )
        .await
        {
            Ok(text) => {
                info!("Transcripción vía proxy en {} OK ({kb} KB)", format.label);
                return Ok(text);
            }
            Err(code) if code == "bad_request" => {
                warn!(
                    "El proveedor rechazó el {}; probando el siguiente",
                    format.label
                );
                last = code;
            }
            Err(code) => return Err(code),
        }
    }
    Err(last)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_tope_de_tiempo_crece_con_el_audio_y_se_corta() {
        // Un dictado de dos segundos no debe esperar dos minutos…
        assert_eq!(request_timeout(0.0), Duration::from_secs(20));
        assert_eq!(request_timeout(60.0), Duration::from_secs(50));
        // …y uno larguísimo tampoco deja al médico esperando sin final.
        assert_eq!(request_timeout(3600.0), Duration::from_secs(120));
    }

    #[test]
    fn una_duracion_absurda_no_rompe_el_calculo() {
        // `audio_seconds` llega de un cálculo con flotantes; un negativo no debe desbordar.
        assert_eq!(request_timeout(-5.0), Duration::from_secs(20));
    }
}
