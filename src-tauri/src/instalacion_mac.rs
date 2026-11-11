//! ¿La app se abrió desde el instalador (.dmg) sin pasar por Aplicaciones?
//!
//! Por qué existe: en Mac, instalar es arrastrar el ícono a la carpeta Aplicaciones, y mucha gente
//! (sobre todo quien no usa Mac a diario) hace doble clic en el ícono DENTRO del .dmg. Todo parece
//! funcionar: se crea la cuenta, se dan los permisos, se dicta. Pero la app está corriendo desde el
//! disco del instalador: al expulsarlo o reiniciar, desaparece; el permiso de Accesibilidad quedó
//! dado a esa copia, y el arranque automático apunta a un disco que ya no existe. El médico vuelve
//! al día siguiente y "la app se borró".
//!
//! La pantalla `InstalarEnAplicaciones` lo detecta al abrir y ofrece un botón que copia la app a
//! /Applications y la vuelve a abrir desde ahí. Si la copia falla (un usuario sin permiso de
//! administrador, por ejemplo), la pantalla explica cómo arrastrarla a mano.

#[cfg(target_os = "macos")]
use std::path::PathBuf;
use tauri::AppHandle;

/// La carpeta `.app` que se está ejecutando: `…/CloseLabs Voice.app/Contents/MacOS/<binario>`.
#[cfg(target_os = "macos")]
fn paquete_actual() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let app = exe.parent()?.parent()?.parent()?.to_path_buf();
    if app.extension().is_some_and(|e| e == "app") {
        Some(app)
    } else {
        None
    }
}

/// `true` si la app corre desde el disco del instalador o desde la copia temporal que macOS crea al
/// abrir algo descargado sin moverlo (App Translocation). En Windows y en desarrollo, `false`.
#[tauri::command]
#[specta::specta]
pub fn abierta_desde_instalador() -> bool {
    #[cfg(target_os = "macos")]
    if let Some(app) = paquete_actual() {
        let ruta = app.to_string_lossy();
        return ruta.starts_with("/Volumes/") || ruta.contains("/AppTranslocation/");
    }
    false
}

/// Copia la app a /Applications, la abre desde ahí y cierra esta. Si ya había una versión en
/// Aplicaciones, se reemplaza: la que el médico acaba de bajar es la que quiere usar.
#[tauri::command]
#[specta::specta]
pub fn mover_a_aplicaciones(app: AppHandle) -> Result<(), String> {
    mover(&app)
}

#[cfg(target_os = "macos")]
fn mover(app: &AppHandle) -> Result<(), String> {
    use log::{info, warn};
    use std::process::Command;

    let origen = paquete_actual().ok_or("sin_paquete")?;
    let nombre = origen.file_name().ok_or("sin_paquete")?;
    let destino = PathBuf::from("/Applications").join(nombre);

    if destino.exists() {
        std::fs::remove_dir_all(&destino).map_err(|e| {
            warn!("No se pudo quitar la versión anterior de Aplicaciones: {e}");
            "sin_permiso".to_string()
        })?;
    }
    // `ditto` copia el paquete tal cual (firma, enlaces y atributos incluidos); `cp -R` no.
    let copia = Command::new("/usr/bin/ditto")
        .arg(&origen)
        .arg(&destino)
        .status()
        .map_err(|e| {
            warn!("No se pudo ejecutar ditto: {e}");
            "copia".to_string()
        })?;
    if !copia.success() {
        warn!("ditto terminó con {copia}");
        return Err("copia".to_string());
    }
    info!("App copiada a Aplicaciones; se abre desde ahí");

    // ⚠️ Se abre la copia UN SEGUNDO DESPUÉS de que esta termine: si arrancara mientras esta
    // sigue viva, el plugin de instancia única le pasaría el turno a esta y la nueva se cerraría.
    // La ruta va como `$0` y no pegada al comando: así un nombre con espacios no rompe nada.
    Command::new("/bin/sh")
        .arg("-c")
        .arg("sleep 1; /usr/bin/open \"$0\"")
        .arg(&destino)
        .spawn()
        .map_err(|e| {
            warn!("No se pudo programar la apertura desde Aplicaciones: {e}");
            "abrir".to_string()
        })?;
    app.exit(0);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn mover(_app: &AppHandle) -> Result<(), String> {
    Err("solo_mac".to_string())
}
