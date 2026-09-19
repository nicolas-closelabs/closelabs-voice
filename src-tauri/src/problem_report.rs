//! CloseLabs Voice — "Reportar un problema" (Fase 1).
//!
//! Cuando un médico dice "no me funciona", hoy eso es todo lo que tenemos. El log está en su
//! computador, en una carpeta que no sabe encontrar, y pedirle que la busque no es soporte.
//!
//! ⚠️ **Este módulo saca un archivo del computador del médico, así que la limpieza es la parte
//! importante, no el envío.** El log NO contiene audio ni texto dictado —eso se arregló en la
//! Fase 0— pero sí contiene cosas que no tienen por qué salir:
//!
//! - El **nombre de usuario** del sistema, en cada ruta.
//! - El **token del dispositivo**, que es una credencial. (Ya no se escribe —ver `Secret` en
//!   `settings.rs`— pero un log de una versión anterior todavía lo tiene, y ese es justo el que
//!   se va a subir cuando alguien actualice y reporte.)
//! - El **diccionario del médico**, que puede tener nombres de pacientes.
//! - Correos electrónicos.
//!
//! La regla al escribir reglas nuevas: ante la duda, se borra. Un log con un hueco se puede
//! pedir de nuevo; un dato de paciente publicado no se puede recoger.

use std::time::Duration;

use log::{info, warn};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::settings::get_settings;

/// Cuánto log se manda, contando desde el final. Son varias horas de uso normal, y el problema
/// que motiva el reporte acaba de pasar. Mandar el archivo entero solo añade riesgo.
const MAX_LOG_BYTES: usize = 256 * 1024;

const TIMEOUT: Duration = Duration::from_secs(30);

/// Nombre de usuario en rutas de macOS, Linux y Windows.
static USER_PATH: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)([/\\](?:Users|home)[/\\])([^/\\\s\x22'\),;:]+)").expect("regex de rutas")
});

/// El diccionario del médico. Se conserva CUÁNTOS términos hay —eso explica varios problemas
/// reales, como la pista de vocabulario demasiado larga— pero no cuáles son.
static CUSTOM_WORDS: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"custom_words:\s*\[[^\]]*\]").expect("regex del diccionario"));

static EMAIL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}").expect("regex de correos")
});

/// Credenciales nombradas explícitamente en el texto.
static NAMED_SECRET: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)(device_token|api_key|token|authorization|bearer)(\s*[:=]\s*|\s+)(Some\()?["']?([A-Za-z0-9_\-\.]{12,})["']?\)?"#)
        .expect("regex de credenciales")
});

/// Red de seguridad para lo que no tiene nombre: una tira larga de caracteres de base64url.
///
/// El umbral de 40 es deliberado. Los tokens que nos importan miden 43; lo que aparece de verdad
/// en nuestros logs —nombres de modelo, rutas, identificadores— lleva puntos o barras y se queda
/// por debajo. Si alguna vez se lleva por delante algo legítimo, el precio es una línea menos
/// legible, que es un precio barato comparado con el otro error.
static LONG_SECRET: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b[A-Za-z0-9_\-]{40,}\b").expect("regex de tiras largas"));

/// Limpia el log antes de que salga del computador.
pub fn scrub(text: &str) -> String {
    let out = USER_PATH.replace_all(text, "${1}[usuario]");
    let out = CUSTOM_WORDS.replace_all(&out, |caps: &regex::Captures| {
        // Se cuentan los términos por las comillas de apertura para no depender de las comas.
        let n = caps[0].matches('"').count() / 2;
        if n == 1 {
            "custom_words: [1 término oculto]".to_string()
        } else {
            format!("custom_words: [{n} términos ocultos]")
        }
    });
    let out = NAMED_SECRET.replace_all(&out, "${1}${2}[REDACTADO]");
    let out = EMAIL.replace_all(&out, "[correo]");
    LONG_SECRET.replace_all(&out, "[REDACTADO]").into_owned()
}

/// Lee el final del log y lo limpia. `None` si no hay archivo de log que leer.
fn scrubbed_log_tail(app: &AppHandle) -> Option<String> {
    let path = match crate::portable::data_dir() {
        Some(dir) => dir.join("logs").join("handy.log"),
        None => app.path().app_log_dir().ok()?.join("handy.log"),
    };
    let raw = std::fs::read(&path)
        .map_err(|e| warn!("No se pudo leer el log ({}): {e}", path.display()))
        .ok()?;

    // Se corta por bytes y luego se repara el corte: `from_utf8_lossy` convertiría un carácter
    // partido a la mitad en un símbolo raro, y las tildes son la mitad de nuestros logs.
    let start = raw.len().saturating_sub(MAX_LOG_BYTES);
    let tail = String::from_utf8_lossy(&raw[start..]).into_owned();
    let tail = if start > 0 {
        // La primera línea casi seguro quedó partida: se descarta entera.
        match tail.find('\n') {
            Some(i) => tail[i + 1..].to_string(),
            None => tail,
        }
    } else {
        tail
    };

    Some(scrub(&tail))
}

#[derive(Deserialize)]
struct ReportResponse {
    report_id: String,
}

/// Manda el reporte y devuelve su identificador, que se le muestra al médico.
///
/// Devuelve `Err` con un código de nuestro vocabulario cerrado, igual que el resto del proxy.
#[tauri::command]
#[specta::specta]
pub async fn send_problem_report(app: AppHandle, description: String) -> Result<String, String> {
    let settings = get_settings(&app);
    // Registrarse aquí si hace falta: un médico que nunca pudo dictar —porque el registro
    // falló— es exactamente quien necesita reportar, y quedaría sin poder hacerlo.
    let token = crate::proxy::ensure_device_token(&app)
        .await
        .ok_or_else(|| "sin_conexion".to_string())?;

    let log = scrubbed_log_tail(&app).unwrap_or_default();
    let body = serde_json::json!({
        "description": description,
        "platform": std::env::consts::OS,
        "app_version": app.package_info().version.to_string(),
        "log": log,
    });

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(TIMEOUT)
        .build()
        .map_err(|e| format!("cliente http: {e}"))?;

    let url = format!("{}/report", settings.proxy_base_url.trim_end_matches('/'));
    let res = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            warn!("No se pudo enviar el reporte: {e}");
            "sin_conexion".to_string()
        })?;

    if !res.status().is_success() {
        warn!("El reporte devolvió {}", res.status());
        return Err("fallo_servidor".to_string());
    }

    let parsed: ReportResponse = res
        .json()
        .await
        .map_err(|_| "fallo_servidor".to_string())?;
    info!(
        "Reporte de problema enviado ({} KB de log)",
        log.len() / 1024
    );
    Ok(parsed.report_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_nombre_de_usuario_no_sale_del_equipo() {
        let entrada = "[INFO] modelo en /Users/anagomez/Library/Caches/huggingface/hub";
        let salida = scrub(entrada);
        assert!(!salida.contains("anagomez"));
        // Pero la ruta sigue siendo legible: saber que está en Caches es la mitad del
        // diagnóstico cuando el modelo no carga.
        assert!(salida.contains("/Users/[usuario]/Library/Caches"));
    }

    #[test]
    fn tambien_en_windows_y_linux() {
        assert!(!scrub(r"C:\Users\Dr Perez\AppData\Roaming").contains("Dr"));
        assert!(!scrub("/home/jmartinez/.cache/hf").contains("jmartinez"));
    }

    #[test]
    fn el_token_del_dispositivo_nunca_viaja() {
        // La regresión que motivó todo esto: las versiones anteriores lo escribían en claro, y
        // el log que se sube al reportar puede ser de una de ellas.
        let entrada = r#"device_token: Some("45hY6EmN9aeDi3xXU_jC6NB_r1yrH_r2o8yKaNB9j8w")"#;
        let salida = scrub(entrada);
        assert!(!salida.contains("45hY6EmN9aeDi3xXU"));
        assert!(salida.contains("[REDACTADO]"));
    }

    #[test]
    fn una_credencial_sin_nombre_tambien_cae() {
        // Sin la palabra "token" delante: la red de seguridad por longitud es la que la atrapa.
        let entrada = "enviando 45hY6EmN9aeDi3xXU_jC6NB_r1yrH_r2o8yKaNB9j8w al servidor";
        assert!(!scrub(entrada).contains("45hY6EmN9aeDi3xXU"));
    }

    #[test]
    fn el_diccionario_del_medico_no_sale_pero_su_tamano_si() {
        // Los términos pueden ser nombres de pacientes. El NÚMERO explica problemas reales
        // (una pista de vocabulario demasiado larga), así que ese se conserva.
        let entrada = r#"custom_words: ["Fernandinho", "Isotetrinoina", "CloseLabs"], model_unload"#;
        let salida = scrub(entrada);
        assert!(!salida.contains("Fernandinho"));
        assert!(!salida.contains("Isotetrinoina"));
        assert!(salida.contains("3 términos ocultos"));
        // Y no se come lo que viene después.
        assert!(salida.contains("model_unload"));
    }

    #[test]
    fn los_correos_se_tapan() {
        assert!(!scrub("normalizado a nicolas@closelabs.co").contains("nicolas@"));
    }

    #[test]
    fn lo_que_sirve_para_diagnosticar_sobrevive() {
        // La prueba que evita que la limpieza se vuelva inútil de tanto limpiar.
        let entrada = "[2026-09-19][22:30:50][closelabs_voice_lib::proxy][DEBUG] \
                       Dictado vía proxy OK (79 chars crudos, limpieza sí, proveedor groq)";
        assert_eq!(scrub(entrada), entrada);
    }

    #[test]
    fn el_nombre_del_modelo_no_se_rompe() {
        let entrada = "selected_model: \"handy-computer/parakeet-tdt-0.6b-v3-gguf/\
                       parakeet-tdt-0.6b-v3-Q5_K_M.gguf\"";
        assert_eq!(scrub(entrada), entrada);
    }
}
