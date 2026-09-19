//! CloseLabs Voice — configuración remota (Fase 1).
//!
//! Este es el interruptor que hoy no tenemos. Si publicamos una versión con un fallo grave, no
//! hay forma de avisarle a nadie: cada instalación sigue corriendo para siempre. Aquí la app
//! pregunta al arrancar —y cada pocas horas— si su versión sigue siendo válida.
//!
//! Dos niveles, y la diferencia importa:
//!
//! - **Aviso** (`latest_version`): hay algo nuevo. Se muestra, se puede cerrar, se sigue dictando.
//!   Es el caso normal.
//! - **Bloqueo** (`min_supported_version`): esta versión no debe usarse. El dictado se detiene.
//!   Es el martillo, y se reserva para una versión rota o peligrosa — quitarle el dictado a un
//!   médico a mitad de consulta es caro.
//!
//! ⚠️ **Falla hacia abierto, siempre.** Sin internet, con el servidor caído, con una respuesta
//! rara o con una versión que no se puede interpretar, **no se bloquea nada**. La regla es que
//! solo un servidor que responde bien y dice explícitamente que esta versión quedó atrás puede
//! detener el dictado. Un problema nuestro de infraestructura jamás puede dejar mudo un
//! consultorio: eso sería un daño peor que el que esta función previene.

use std::sync::RwLock;
use std::time::Duration;

use log::{debug, info, warn};
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::settings::get_settings;

/// La respuesta es diminuta; si tarda más que esto, no vale la pena seguir esperando.
const TIMEOUT: Duration = Duration::from_secs(10);
/// Margen antes de la primera consulta: el arranque ya está cargando el modelo y montando la
/// ventana, y esto no tiene ninguna prisa.
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(5);
/// Cada cuánto se vuelve a preguntar. Una app de dictado se queda abierta días enteros.
const RECHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

/// Estado que la app muestra al médico. Se envía al frontend tal cual.
#[derive(Clone, Debug, Serialize, PartialEq, Eq, specta::Type)]
pub struct BlockState {
    pub message: String,
    pub download_url: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq, specta::Type)]
pub struct UpdateNotice {
    pub latest_version: String,
    pub download_url: String,
}

#[derive(Deserialize)]
struct ConfigResponse {
    min_supported_version: String,
    #[serde(default)]
    latest_version: Option<String>,
    blocked_message: String,
    download_url: String,
}

/// `Some` mientras esta versión esté bloqueada. Lo lee el flujo del dictado antes de grabar.
static BLOCKED: RwLock<Option<BlockState>> = RwLock::new(None);

/// `Some` si esta versión quedó por debajo del mínimo soportado.
pub fn block_state() -> Option<BlockState> {
    BLOCKED.read().ok().and_then(|b| b.clone())
}

/// Lo mismo, para el frontend.
///
/// Hace falta además del evento `app-blocked` por una carrera real: la consulta al servidor puede
/// resolverse antes de que la ventana termine de cargar, y entonces el evento se emite sin que
/// nadie lo escuche. Sin esto, la pantalla de bloqueo no aparecería hasta la siguiente consulta
/// —seis horas después—. El frontend pregunta al montarse y así cubre los dos casos.
#[tauri::command]
#[specta::specta]
pub fn get_block_state() -> Option<BlockState> {
    block_state()
}

/// Compara la versión instalada contra la que manda el servidor.
///
/// Devuelve `false` ante cualquier duda: un valor sin sentido en la base no puede bloquear a
/// nadie. Es la regla de fallar hacia abierto, aplicada al dato en vez de a la red.
fn is_older(current: &Version, remote: &str) -> bool {
    match Version::parse(remote.trim()) {
        Ok(r) => current < &r,
        Err(e) => {
            warn!("El servidor mandó una versión que no se entiende ('{remote}': {e}); se ignora");
            false
        }
    }
}

/// Pregunta al servidor y aplica lo que diga. Silenciosa: no molesta al médico si algo falla.
async fn check(app: &AppHandle) {
    let settings = get_settings(app);
    let current = app.package_info().version.clone();

    // El token es opcional aquí y no autoriza nada; sirve para que el servidor sepa qué versión
    // corre esta instalación. Si todavía no hay token, la consulta se hace igual: no vamos a
    // registrar una instalación solo para preguntar la versión.
    let token = settings.device_token.clone().filter(|t| !t.is_empty());
    let url = format!(
        "{}/config?app_version={current}",
        settings.proxy_base_url.trim_end_matches('/')
    );

    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(TIMEOUT)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            warn!("No se pudo crear el cliente para la configuración remota: {e}");
            return;
        }
    };

    let mut req = client.get(&url);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }

    let res = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            debug!("Sin configuración remota ({e}); se continúa normal");
            return;
        }
    };
    if !res.status().is_success() {
        debug!("La configuración remota devolvió {}; se continúa normal", res.status());
        return;
    }
    let cfg: ConfigResponse = match res.json().await {
        Ok(c) => c,
        Err(e) => {
            warn!("Configuración remota ilegible ({e}); se continúa normal");
            return;
        }
    };

    if is_older(&current, &cfg.min_supported_version) {
        let state = BlockState {
            message: cfg.blocked_message,
            download_url: cfg.download_url.clone(),
        };
        let changed = {
            let mut slot = match BLOCKED.write() {
                Ok(s) => s,
                Err(e) => {
                    warn!("No se pudo guardar el estado de bloqueo: {e}");
                    return;
                }
            };
            let changed = slot.as_ref() != Some(&state);
            *slot = Some(state.clone());
            changed
        };
        if changed {
            warn!(
                "Esta versión ({current}) quedó por debajo del mínimo soportado ({}); se bloquea el dictado",
                cfg.min_supported_version
            );
            let _ = app.emit("app-blocked", &state);
        }
        return;
    }

    // Se levanta el bloqueo si el servidor cambió de opinión: sin esto, bajar el mínimo en la
    // base no tendría efecto hasta que el médico reiniciara la app.
    if let Ok(mut slot) = BLOCKED.write() {
        if slot.take().is_some() {
            info!("El servidor levantó el bloqueo de esta versión");
            let _ = app.emit("app-unblocked", ());
        }
    }

    if let Some(latest) = cfg.latest_version.filter(|v| is_older(&current, v)) {
        info!("Hay una versión nueva disponible ({latest}); esta es {current}");
        let _ = app.emit(
            "update-available",
            UpdateNotice {
                latest_version: latest,
                download_url: cfg.download_url,
            },
        );
    }
}

/// Arranca la consulta periódica. No bloquea el arranque de la app.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(FIRST_CHECK_DELAY).await;
        loop {
            check(&app).await;
            tokio::time::sleep(RECHECK_EVERY).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn una_version_vieja_se_detecta() {
        let current = Version::parse("0.5.0").unwrap();
        assert!(is_older(&current, "0.6.0"));
        assert!(is_older(&current, "1.0.0"));
        assert!(is_older(&current, "0.5.1"));
    }

    #[test]
    fn la_version_actual_y_las_nuevas_no_se_bloquean() {
        let current = Version::parse("0.5.0").unwrap();
        assert!(!is_older(&current, "0.5.0"));
        assert!(!is_older(&current, "0.4.9"));
    }

    #[test]
    fn una_version_ilegible_nunca_bloquea() {
        // El caso que importa: un dedazo en la base —o una columna vacía— NO puede dejar sin
        // dictar a todos los médicos. Ante la duda, se sigue trabajando.
        let current = Version::parse("0.5.0").unwrap();
        assert!(!is_older(&current, ""));
        assert!(!is_older(&current, "próximamente"));
        assert!(!is_older(&current, "v9.9.9")); // la 'v' no es semver válido
        assert!(!is_older(&current, "999"));
    }

    #[test]
    fn los_espacios_alrededor_no_estorban() {
        // Copiar y pegar en el panel de la base deja espacios con facilidad.
        let current = Version::parse("0.5.0").unwrap();
        assert!(is_older(&current, "  0.6.0 \n"));
    }
}
