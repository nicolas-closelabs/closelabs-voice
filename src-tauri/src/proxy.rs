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

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use log::{debug, info, warn};
use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::settings::{get_settings, write_settings};

/// Abrir la conexión. Si no hay internet, caer al motor local en 3 s y no en 60.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
/// El alta solo ocurre una vez y es un JSON diminuto.
const REGISTER_TIMEOUT: Duration = Duration::from_secs(10);
/// Tope del formateo, igual que el del servidor (`PRESUPUESTO_MS` en `_shared/format.ts`): pasado
/// esto se pega el texto crudo.
///
/// ⚠️ Subido de 15 s a 30 s el 2026-09-22. El formateo tarda en proporción al LARGO del dictado
/// (~830 tokens por segundo medidos contra Groq), y con el techo de salida en 8.000 tokens un
/// dictado de 5 minutos necesita ~9 s solo de generación, más el respaldo si el principal falla.
/// Con 15 s la app cortaba por su cuenta un formateo que el servidor iba a entregar.
const FORMAT_TIMEOUT: Duration = Duration::from_secs(30);

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

/// Respuesta de `/dictate`: transcripción y limpieza en una sola llamada.
#[derive(Deserialize)]
struct DictateResponse {
    text_raw: String,
    /// `None` si el formateo falló. No es motivo de error: se pega el texto crudo, que es
    /// infinitamente mejor que perder el dictado.
    text_final: Option<String>,
    #[serde(default)]
    prompt_sent: bool,
    #[serde(default)]
    provider: String,
}

/// Lo que devuelve un dictado completo.
pub struct Dictation {
    pub raw: String,
    pub formatted: Option<String>,
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

/// Un solo cliente para toda la app, que guarda las conexiones abiertas entre un dictado y otro.
///
/// ⚠️ Antes se creaba uno nuevo en CADA llamada, y cada dictado pagaba de cero la conexión segura
/// con el servidor (DNS, TCP y TLS hasta São Paulo) antes de empezar a subir el audio. Con un
/// cliente compartido, la conexión que abre [`calentar`] al empezar a grabar es la misma que usa
/// el dictado al terminar. El tope de tiempo va en cada llamada (`.timeout(…)`), no en el cliente.
fn client() -> Result<&'static reqwest::Client, String> {
    static CLIENTE: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENTE
        .get_or_init(|| {
            reqwest::Client::builder()
                .connect_timeout(CONNECT_TIMEOUT)
                .build()
                .map_err(|e| format!("cliente http: {e}"))
        })
        .as_ref()
        .map_err(|e| e.clone())
}

/// Cada cuánto se vuelve a tocar el servidor mientras el médico sigue hablando. Por debajo de los
/// 90 s que el cliente guarda una conexión sin uso, para que un dictado largo no la pierda.
const RECALENTAR_CADA: Duration = Duration::from_secs(40);
/// Tope de vueltas: si el atajo de parar nunca llega (la app se colgó a mitad), no se queda
/// tocando el servidor para siempre. 15 × 40 s = 10 min de dictado.
const MAX_VUELTAS: u32 = 15;
const CALENTAR_TIMEOUT: Duration = Duration::from_secs(5);

/// Cambia con cada grabación que empieza: si el médico vuelve a grabar antes de que el
/// calentamiento anterior termine, queda uno solo.
static GRABACION: AtomicU64 = AtomicU64::new(0);

/// Deja lista la línea con el servidor MIENTRAS el médico habla, para que al soltar el atajo el
/// audio salga de inmediato.
///
/// Hace un GET a `/dictate`, que contesta 405 sin mirar la cuenta ni tocar ningún proveedor. Con
/// eso se consiguen dos cosas: la conexión segura queda abierta en el cliente compartido y la
/// función del servidor queda despierta (si llevaba un rato sin uso, el primer dictado pagaba su
/// arranque). No sube audio ni gasta cupo.
///
/// Se repite cada [`RECALENTAR_CADA`] mientras dure la grabación (se pare o se cancele, se detiene
/// en la vuelta siguiente). Si falla (sin internet) no pasa nada: el dictado hará lo mismo de
/// siempre.
pub fn calentar(app: &AppHandle) {
    let settings = get_settings(app);
    if !settings.cloud_transcription_enabled {
        return;
    }
    let url = format!("{}/dictate", settings.proxy_base_url.trim_end_matches('/'));
    let esta = GRABACION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        for _ in 0..MAX_VUELTAS {
            let inicio = Instant::now();
            match client() {
                Ok(c) => match c.get(&url).timeout(CALENTAR_TIMEOUT).send().await {
                    // Se lee el cuerpo entero: una conexión con respuesta a medio leer no vuelve
                    // al grupo y no se podría reutilizar.
                    Ok(res) => {
                        let _ = res.bytes().await;
                        debug!("Conexión con el servidor lista en {:?}", inicio.elapsed());
                    }
                    Err(e) => debug!("No se pudo calentar la conexión: {e}"),
                },
                Err(e) => debug!("{e}"),
            }
            tokio::time::sleep(RECALENTAR_CADA).await;
            let sigue_grabando = app
                .state::<std::sync::Arc<crate::managers::audio::AudioRecordingManager>>()
                .is_recording();
            if !sigue_grabando || GRABACION.load(Ordering::SeqCst) != esta {
                break;
            }
        }
    });
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

/// Códigos con los que el servidor dice "esta cuenta NO puede dictar" (no pagó, se acabó la
/// prueba, se pasó del cupo, el equipo está revocado).
///
/// ⚠️ Son distintos de un fallo técnico, y el trato tiene que ser distinto: ante un fallo técnico
/// (sin internet, proveedor caído) se cae al motor LOCAL, porque dejar al médico sin dictar en
/// plena consulta es peor. Pero con estos códigos ese respaldo se vuelve un agujero: quien deja
/// de pagar seguiría dictando gratis para siempre, con solo apagar el wifi. Aquí se corta.
pub const CODIGOS_SIN_PERMISO: [&str; 6] = [
    "unauthorized",
    "no_account",
    "subscription_missing",
    "trial_ended",
    "subscription_inactive",
    "quota_exceeded",
];

pub fn es_sin_permiso(code: &str) -> bool {
    CODIGOS_SIN_PERMISO.contains(&code)
}

/// Token de esta instalación. La primera vez lo pide al servidor y lo guarda en los ajustes.
///
/// Devuelve `None` si no se pudo registrar (sin internet, servidor caído): el llamador cae al
/// motor local, igual que hacía antes cuando fallaba la nube.
pub async fn ensure_device_token(app: &AppHandle) -> Option<String> {
    let settings = get_settings(app);
    if let Some(token) = settings.device_token.get().filter(|t| !t.is_empty()).cloned() {
        return Some(token);
    }

    let url = format!("{}/register", settings.proxy_base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "platform": std::env::consts::OS,
        "app_version": app.package_info().version.to_string(),
    });

    let res = client()
        .ok()?
        .post(&url)
        .timeout(REGISTER_TIMEOUT)
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
    updated.device_token.set(Some(token.clone()));
    write_settings(app, updated);
    info!("Instalación registrada en el proxy de CloseLabs");
    Some(token)
}

/// Olvida el token de esta instalación para que la próxima llamada registre uno nuevo.
///
/// Se usa cuando el equipo quedó vinculado a otra cuenta (ver `vincular_este_equipo` en auth.rs).
pub fn olvidar_device_token(app: &AppHandle) {
    let mut updated = get_settings(app);
    updated.device_token.set(None);
    write_settings(app, updated);
}

/// Transcribe y limpia en UNA sola llamada.
///
/// Medido el 2026-09-19: hacerlo en dos llamadas costaba **1,84 s más** por dictado. No era solo
/// el viaje de ida y vuelta extra — cada llamada pagaba además su propio arranque de la función
/// en el servidor.
///
/// Esto solo fue posible después de decidir que el diccionario del médico se aplica al FINAL:
/// antes corría en el cliente entre las dos llamadas, y eso impedía unirlas.
pub async fn dictate(
    app: &AppHandle,
    audio: Vec<u8>,
    filename: &str,
    mime: &str,
    audio_seconds: f32,
    language: Option<&str>,
    prompt: Option<&str>,
    system_prompt: Option<&str>,
) -> Result<Dictation, String> {
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
    if let Some(sp) = system_prompt {
        form = form.text("system_prompt", sp.to_string());
    }

    // El tope cubre transcripción + limpieza, así que se le suma el presupuesto del formateo.
    let timeout = request_timeout(audio_seconds) + FORMAT_TIMEOUT;
    let url = format!("{}/dictate", settings.proxy_base_url.trim_end_matches('/'));

    let enviado = Instant::now();
    let res = client()?
        .post(&url)
        .timeout(timeout)
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("proxy dictate: {e}"))?;
    // Desde que sale el audio hasta que llega la respuesta: subida + transcripción + limpieza. Lo
    // del servidor está en `usage_events`; la diferencia es la red del médico.
    let espera = enviado.elapsed();

    if !res.status().is_success() {
        return Err(error_code(res).await);
    }

    let body: DictateResponse = res
        .json()
        .await
        .map_err(|e| format!("respuesta del proxy: {e}"))?;
    info!(
        "Tiempos del dictado: {:.1} s de audio, subida+servidor {} ms, respuesta leída a los {} ms",
        audio_seconds,
        espera.as_millis(),
        enviado.elapsed().as_millis()
    );

    if prompt.is_some() && !body.prompt_sent {
        debug!("El proveedor actual no acepta la pista del diccionario; se transcribió sin ella");
    }
    debug!(
        "Dictado vía proxy OK ({} chars crudos, limpieza {}, proveedor {})",
        body.text_raw.chars().count(),
        if body.text_final.is_some() {
            "sí"
        } else {
            "no"
        },
        body.provider
    );
    Ok(Dictation {
        raw: body.text_raw,
        formatted: body.text_final,
    })
}

/// Limpia `text` con el formateador que decida el servidor.
pub async fn format(app: &AppHandle, text: &str, system_prompt: &str) -> Result<String, String> {
    let settings = get_settings(app);
    let token = ensure_device_token(app)
        .await
        .ok_or_else(|| "sin token de instalación".to_string())?;

    let url = format!("{}/format", settings.proxy_base_url.trim_end_matches('/'));
    let res = client()?
        .post(&url)
        .timeout(FORMAT_TIMEOUT)
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

/// Dicta `samples` subiendo **Opus** y, si el proveedor rechazara el formato, bajando a FLAC y
/// luego a WAV. Es la misma cadena de siempre: comprimir agresivamente para el internet lento de
/// las clínicas, con WAV al final como garantía de no quedar peor que sin comprimir.
///
/// Solo se baja un escalón si la codificación falla o si el servidor responde `bad_request`.
/// Cualquier otro error (sin red, cupo agotado, el proveedor caído) corta la cadena: no tiene
/// sentido resubir el mismo audio por un problema que no es de formato.
pub async fn dictate_with_fallback(
    app: &AppHandle,
    samples: &[f32],
    language: Option<&str>,
    prompt: Option<&str>,
    system_prompt: Option<&str>,
) -> Result<Dictation, String> {
    const IN_RATE: usize = 16_000;
    let audio_seconds = samples.len() as f32 / IN_RATE as f32;

    let mut last = "no se pudo codificar el audio en ningún formato".to_string();
    for format in crate::groq_transcribe::UPLOAD_FORMATS {
        let codificando = Instant::now();
        let bytes = match (format.encode)(samples) {
            Ok(b) => b,
            Err(e) => {
                warn!("Falló codificar {} ({e}); siguiente formato", format.label);
                last = e;
                continue;
            }
        };
        let kb = bytes.len() / 1024;
        info!(
            "Audio codificado en {} en {} ms ({kb} KB)",
            format.label,
            codificando.elapsed().as_millis()
        );
        match dictate(
            app,
            bytes,
            format.filename,
            format.mime,
            audio_seconds,
            language,
            prompt,
            system_prompt,
        )
        .await
        {
            Ok(d) => {
                info!("Dictado vía proxy en {} OK ({kb} KB)", format.label);
                return Ok(d);
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
