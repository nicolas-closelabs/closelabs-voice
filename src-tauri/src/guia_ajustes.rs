//! La ventanita que se pega debajo de Ajustes del Sistema mientras el médico da el permiso de
//! Accesibilidad (Mac).
//!
//! Por qué existe: dar ese permiso es el paso donde más se pierde nuestro público. Antes la app
//! explicaba con un dibujo qué buscar en Ajustes, pero el dibujo quedaba DETRÁS de la ventana de
//! Ajustes justo cuando el médico la necesitaba. Esta ventanita va pegada al borde de abajo de
//! Ajustes, sigue a Ajustes si el médico la mueve y dice, con una flecha hacia arriba, qué tocar.
//! (Idea tomada del onboarding de Wispr Flow; decisión de Nicolás del 2026-11-11.)
//!
//! Cómo encuentra Ajustes sin pedir ningún permiso: `CGWindowListCopyWindowInfo` devuelve la
//! posición y el duenio de cada ventana en pantalla sin el permiso de Grabación de pantalla (ese
//! permiso solo hace falta para leer el TÍTULO de la ventana, que aquí no se usa). Se busca por el
//! nombre del proceso, en inglés y en español porque macOS lo traduce.
//!
//! Se cierra sola cuando el permiso se concede (lo decide la interfaz con `ocultar_guia_ajustes`),
//! si Ajustes se cierra o, como tope, a los 10 minutos.

use tauri::AppHandle;

#[cfg(target_os = "macos")]
mod mac {
    use core_foundation::base::{CFType, TCFType};
    use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
    use core_foundation::number::CFNumber;
    use core_foundation::string::CFString;
    use core_graphics::window::{
        copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements,
        kCGWindowListOptionOnScreenOnly,
    };
    use log::{debug, info};
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};

    pub const ETIQUETA: &str = "guia_ajustes";
    pub const ANCHO: f64 = 540.0;
    pub const ALTO: f64 = 86.0;
    /// Separación entre el borde de abajo de Ajustes y la ventanita.
    const SEPARACION: f64 = 10.0;
    const TOPE: Duration = Duration::from_secs(600);

    /// Cómo se llama el proceso de Ajustes según la versión y el idioma de macOS.
    const DUENIOS: [&str; 4] = [
        "System Settings",
        "Ajustes del Sistema",
        "System Preferences",
        "Preferencias del Sistema",
    ];

    static ACTIVA: AtomicBool = AtomicBool::new(false);
    /// Sube cada vez que se pide mostrarla: un hilo viejo que ve otro número se retira.
    static TURNO: AtomicU64 = AtomicU64::new(0);

    #[derive(Clone, Copy, PartialEq)]
    struct Marco {
        x: f64,
        y: f64,
        ancho: f64,
        alto: f64,
    }

    fn numero(d: &CFDictionary<CFString, CFType>, clave: &str) -> Option<f64> {
        d.find(CFString::new(clave))
            .and_then(|v| v.downcast::<CFNumber>())
            .and_then(|n| n.to_f64())
    }

    /// La ventana principal de Ajustes en pantalla (la más grande del proceso, en la capa normal).
    fn ventana_de_ajustes() -> Option<Marco> {
        let ventanas = copy_window_info(
            kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
            kCGNullWindowID,
        )?;

        let mut mejor: Option<Marco> = None;
        for item in ventanas.iter() {
            let v: CFDictionary<CFString, CFType> =
                unsafe { CFDictionary::wrap_under_get_rule(*item as CFDictionaryRef) };
            let duenio = v
                .find(CFString::new("kCGWindowOwnerName"))
                .and_then(|s| s.downcast::<CFString>())
                .map(|s| s.to_string());
            if !duenio.is_some_and(|d| DUENIOS.contains(&d.as_str())) {
                continue;
            }
            // Capa 0 = ventanas normales (no menús ni hojas flotantes).
            if numero(&v, "kCGWindowLayer").unwrap_or(1.0) != 0.0 {
                continue;
            }
            let Some(limites) = v
                .find(CFString::new("kCGWindowBounds"))
                .and_then(|b| b.downcast::<CFDictionary>())
            else {
                continue;
            };
            let limites: CFDictionary<CFString, CFType> =
                unsafe { CFDictionary::wrap_under_get_rule(limites.as_concrete_TypeRef()) };
            let (Some(x), Some(y), Some(ancho), Some(alto)) = (
                numero(&limites, "X"),
                numero(&limites, "Y"),
                numero(&limites, "Width"),
                numero(&limites, "Height"),
            ) else {
                continue;
            };
            if ancho < 200.0 || alto < 200.0 {
                continue;
            }
            if mejor.map_or(true, |m| ancho * alto > m.ancho * m.alto) {
                mejor = Some(Marco { x, y, ancho, alto });
            }
        }
        mejor
    }

    /// Dónde va la ventanita: centrada debajo de Ajustes; si no cabe debajo (Ajustes llega al
    /// borde de la pantalla), se monta sobre el borde de abajo de Ajustes, por dentro.
    fn posicion(app: &AppHandle, m: Marco) -> LogicalPosition<f64> {
        let x = m.x + (m.ancho - ANCHO) / 2.0;
        let mut y = m.y + m.alto + SEPARACION;
        if let Ok(Some(monitor)) = app.primary_monitor() {
            let escala = monitor.scale_factor();
            let alto_pantalla = monitor.size().height as f64 / escala;
            if y + ALTO > alto_pantalla - 4.0 {
                y = m.y + m.alto - ALTO - 16.0;
            }
        }
        LogicalPosition::new(x.max(0.0), y.max(0.0))
    }

    pub fn mostrar(app: &AppHandle) -> Result<(), String> {
        let turno = TURNO.fetch_add(1, Ordering::SeqCst) + 1;
        ACTIVA.store(true, Ordering::SeqCst);

        if app.get_webview_window(ETIQUETA).is_none() {
            WebviewWindowBuilder::new(
                app,
                ETIQUETA,
                WebviewUrl::App("src/guia-ajustes/index.html".into()),
            )
            .title("CloseLabs Voice")
            .inner_size(ANCHO, ALTO)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .build()
            .map_err(|e| format!("no se pudo crear la guía: {e}"))?;
        }

        let app = app.clone();
        std::thread::spawn(move || {
            let inicio = Instant::now();
            let mut ultimo: Option<Marco> = None;
            let mut sin_ajustes_desde: Option<Instant> = None;
            let mut visible = false;
            info!("Guía de Ajustes: buscando la ventana de Ajustes del Sistema");
            loop {
                if !ACTIVA.load(Ordering::SeqCst) || TURNO.load(Ordering::SeqCst) != turno {
                    break;
                }
                if inicio.elapsed() > TOPE {
                    debug!("Guía de Ajustes: tope de tiempo");
                    break;
                }
                let Some(ventana) = app.get_webview_window(ETIQUETA) else { break };
                match ventana_de_ajustes() {
                    Some(m) => {
                        sin_ajustes_desde = None;
                        if ultimo != Some(m) {
                            let _ = ventana.set_position(posicion(&app, m));
                            ultimo = Some(m);
                        }
                        if !visible {
                            let _ = ventana.show();
                            visible = true;
                        }
                    }
                    None => {
                        if visible {
                            let _ = ventana.hide();
                            visible = false;
                        }
                        // Ajustes se cerró (o todavía no abre): se espera un rato antes de rendirse.
                        let desde = *sin_ajustes_desde.get_or_insert_with(Instant::now);
                        if ultimo.is_some() && desde.elapsed() > Duration::from_secs(20) {
                            debug!("Guía de Ajustes: Ajustes se cerró");
                            break;
                        }
                    }
                }
                std::thread::sleep(Duration::from_millis(250));
            }
            if TURNO.load(Ordering::SeqCst) == turno {
                ACTIVA.store(false, Ordering::SeqCst);
                if let Some(v) = app.get_webview_window(ETIQUETA) {
                    let _ = v.hide();
                }
            }
        });
        Ok(())
    }

    pub fn ocultar(app: &AppHandle) {
        ACTIVA.store(false, Ordering::SeqCst);
        if let Some(v) = app.get_webview_window(ETIQUETA) {
            let _ = v.hide();
        }
    }
}

/// Muestra la ventanita pegada a Ajustes del Sistema. En Windows no hace nada (no hay permiso de
/// Accesibilidad que dar).
#[tauri::command]
#[specta::specta]
pub fn mostrar_guia_ajustes(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return mac::mostrar(&app);
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }
}

/// Esconde la ventanita (el permiso ya se dio, o el médico salió del paso).
#[tauri::command]
#[specta::specta]
pub fn ocultar_guia_ajustes(app: AppHandle) {
    #[cfg(target_os = "macos")]
    mac::ocultar(&app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}
