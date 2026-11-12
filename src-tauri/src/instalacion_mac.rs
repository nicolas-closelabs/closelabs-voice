//! ¿La app se abrió desde el instalador (.dmg) sin pasar por Aplicaciones?
//!
//! Por qué existe: en Mac, instalar suele ser arrastrar el ícono a la carpeta Aplicaciones, y es el
//! gesto que más le cuesta a nuestro público. Desde 2026-11-11 (decisión de Nicolás) el .dmg ya no
//! trae la carpeta Aplicaciones: solo el ícono y "Haz doble clic aquí para instalar". Al abrirla
//! desde el disco, la app se copia sola a Aplicaciones, le quita la cuarentena, expulsa el disco del
//! instalador y se vuelve a abrir desde ahí. El médico hace UN doble clic y ya.
//!
//! Sin esto, la app correría desde el disco del instalador: todo parece funcionar, pero al expulsarlo
//! o reiniciar desaparece, el permiso de Accesibilidad queda dado a esa copia y el arranque
//! automático apunta a un disco que ya no existe.
//!
//! Si /Applications no se puede escribir (un usuario sin permiso de administrador), se instala en la
//! carpeta Aplicaciones del propio usuario (~/Applications), que macOS también reconoce.

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

/// Paso 1 y 2 de "Instalando": copia la app a Aplicaciones (o a ~/Applications sin permiso de
/// administrador) y le quita la cuarentena. Devuelve dónde quedó. La interfaz muestra cada paso al
/// menos 1,2 s y después llama a `relanzar_instalada`.
#[tauri::command]
#[specta::specta]
pub fn copiar_a_aplicaciones() -> Result<String, String> {
    copiar()
}

/// Paso 3: abre la copia instalada, expulsa el disco del instalador y cierra esta.
#[tauri::command]
#[specta::specta]
pub fn relanzar_instalada(app: AppHandle, destino: String) -> Result<(), String> {
    relanzar(&app, destino)
}

/// `true` si esta es la copia que la del disco acaba de abrir desde Aplicaciones (`--recien-instalada`).
#[tauri::command]
#[specta::specta]
pub fn recien_instalada(args: tauri::State<'_, crate::cli::CliArgs>) -> bool {
    args.recien_instalada
}

/// Copia `origen` dentro de `carpeta`, reemplazando la versión anterior si la hay.
#[cfg(target_os = "macos")]
fn copiar_en(origen: &std::path::Path, carpeta: &std::path::Path) -> Result<PathBuf, String> {
    use log::warn;
    use std::process::Command;

    let nombre = origen.file_name().ok_or("sin_paquete")?;
    let destino = carpeta.join(nombre);
    if !carpeta.exists() {
        std::fs::create_dir_all(carpeta).map_err(|_| "sin_permiso".to_string())?;
    }
    if destino.exists() {
        std::fs::remove_dir_all(&destino).map_err(|e| {
            warn!(
                "No se pudo quitar la versión anterior de {}: {e}",
                carpeta.display()
            );
            "sin_permiso".to_string()
        })?;
    }
    // `ditto` copia el paquete tal cual (firma, enlaces y atributos incluidos); `cp -R` no.
    let copia = Command::new("/usr/bin/ditto")
        .arg(origen)
        .arg(&destino)
        .status()
        .map_err(|e| {
            warn!("No se pudo ejecutar ditto: {e}");
            "copia".to_string()
        })?;
    if !copia.success() {
        warn!("ditto terminó con {copia} copiando a {}", carpeta.display());
        let _ = std::fs::remove_dir_all(&destino);
        return Err("copia".to_string());
    }
    Ok(destino)
}

/// Los discos montados que tienen esta app: el del instalador. Se buscan por contenido y no por la
/// ruta de esta copia porque, si macOS la abrió "trasladada" (App Translocation), la ruta es una
/// carpeta temporal que no dice de qué disco salió.
#[cfg(target_os = "macos")]
fn discos_del_instalador(nombre: &std::ffi::OsStr) -> Vec<PathBuf> {
    std::fs::read_dir("/Volumes")
        .map(|entradas| {
            entradas
                .flatten()
                .map(|e| e.path())
                .filter(|v| v.join(nombre).exists())
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(target_os = "macos")]
fn copiar() -> Result<String, String> {
    use log::{info, warn};
    use std::process::Command;

    let origen = paquete_actual().ok_or("sin_paquete")?;
    let destino = match copiar_en(&origen, std::path::Path::new("/Applications")) {
        Ok(d) => d,
        Err(e) => {
            // Sin permiso de administrador: la carpeta Aplicaciones del usuario.
            let casa = std::env::var_os("HOME").ok_or(e.clone())?;
            warn!("No se pudo instalar en /Applications ({e}); se prueba ~/Applications");
            copiar_en(&origen, &PathBuf::from(casa).join("Applications"))?
        }
    };

    // La copia hereda la marca de "descargado de internet" del .dmg. La app está notarizada, así que
    // abriría igual, pero macOS volvería a preguntar "¿Seguro que quieres abrirla?": una segunda
    // pregunta igual a la que el médico ya contestó. Si no se puede quitar, no pasa nada grave.
    let _ = Command::new("/usr/bin/xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&destino)
        .status();
    info!("App copiada a {}", destino.display());
    Ok(destino.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
fn relanzar(app: &AppHandle, destino: String) -> Result<(), String> {
    use log::{info, warn};
    use std::process::Command;

    let destino = PathBuf::from(destino);
    // Solo se relanza una app que de verdad está en una carpeta Aplicaciones.
    let en_aplicaciones = destino
        .parent()
        .is_some_and(|p| p.file_name().is_some_and(|n| n == "Applications"));
    if !en_aplicaciones || !destino.exists() {
        return Err("destino".to_string());
    }
    let nombre = destino.file_name().ok_or("sin_paquete")?.to_owned();
    info!("Se abre desde {}", destino.display());

    // ⚠️ Todo esto ocurre UN SEGUNDO DESPUÉS de que esta copia termine: si la nueva arrancara
    // mientras esta sigue viva, el plugin de instancia única le pasaría el turno a esta y la nueva
    // se cerraría; y el disco no se puede expulsar mientras algo corre desde él. Primero se expulsa
    // (cierra también la ventana del instalador) y después se abre la copia instalada. Las rutas van
    // como argumentos (`$0`, `$@`) y no pegadas al comando: así un nombre con espacios no rompe nada.
    //
    // La primera apertura lleva `--recien-instalada`: la app nueva abre mostrando el mismo cuadro de
    // "Instalando" (pasos 1 y 2 hechos, el 3 en curso) en el mismo tamaño y lugar, y de ahí funde a la
    // bienvenida (diseno/SISTEMA.md §8).
    //
    // ⚠️ El `open` se repite a los 3 y a los 7 segundos, y no sobra: desde macOS 14 una app que abre
    // un proceso en segundo plano (este `sh`, huérfano tras `app.exit`) arranca SIN pasar al frente.
    // En la revisión del 2026-11-11 la app reinstalada quedó escondida detrás del Finder y el médico
    // pasó ~20 s sin ver nada. Un `open` sobre la app ya abierta sí la trae al frente (y dispara
    // `RunEvent::Reopen`, que muestra la ventana) sin pedir ningún permiso; dos, por si un
    // computador lento todavía no la terminó de abrir a los 3 s.
    let discos = discos_del_instalador(&nombre);
    Command::new("/bin/sh")
        .arg("-c")
        .arg(
            "sleep 1; for d in \"$@\"; do /usr/bin/hdiutil detach \"$d\" -quiet || true; done; \
             /usr/bin/open \"$0\" --args --recien-instalada; sleep 3; /usr/bin/open \"$0\"; \
             sleep 4; /usr/bin/open \"$0\"",
        )
        .arg(&destino)
        .args(&discos)
        .spawn()
        .map_err(|e| {
            warn!("No se pudo programar la apertura desde Aplicaciones: {e}");
            "abrir".to_string()
        })?;
    app.exit(0);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn copiar() -> Result<String, String> {
    Err("solo_mac".to_string())
}

#[cfg(not(target_os = "macos"))]
fn relanzar(_app: &AppHandle, _destino: String) -> Result<(), String> {
    Err("solo_mac".to_string())
}
