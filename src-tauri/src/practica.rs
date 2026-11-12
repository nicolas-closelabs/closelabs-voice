//! Segundo dictado de práctica: fuera de la app, en TextEdit (Mac) o el Bloc de notas (Windows).
//!
//! Por qué existe: el primer dictado de práctica ocurre DENTRO de nuestra ventana, donde el texto
//! llega por otro camino (`dictado-en-la-app`, ver `clipboard.rs`). Afuera es distinto: hace falta
//! el permiso de Accesibilidad en Mac, que el atajo funcione con otra app al frente y que el pegado
//! simulado entre. Si algo de eso falla, mejor que falle aquí, con el tutorial explicando qué hacer,
//! y no en la historia clínica con un paciente delante (decisión de Nicolás, 2026-11-11).
//!
//! Se abre un archivo de texto vacío propio, no el programa a secas: TextEdit, abierto solo, puede
//! mostrar el cuadro de "Abrir archivo" de iCloud en vez de una hoja en blanco, y eso confunde.

use log::{info, warn};
use std::process::Command;

/// Abre una hoja en blanco en el editor de texto del sistema.
#[tauri::command]
#[specta::specta]
pub fn abrir_editor_de_prueba() -> Result<(), String> {
    let archivo = std::env::temp_dir().join("Prueba de dictado.txt");
    // Siempre vacío: si quedó texto de una práctica anterior, el médico no sabría qué es nuevo.
    std::fs::write(&archivo, "").map_err(|e| {
        warn!("No se pudo crear la hoja de prueba: {e}");
        "archivo".to_string()
    })?;

    #[cfg(target_os = "macos")]
    let r = Command::new("/usr/bin/open")
        .args(["-a", "TextEdit"])
        .arg(&archivo)
        .spawn();
    #[cfg(target_os = "windows")]
    let r = Command::new("notepad.exe").arg(&archivo).spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let r = Command::new("xdg-open").arg(&archivo).spawn();

    r.map_err(|e| {
        warn!("No se pudo abrir el editor de prueba: {e}");
        "abrir".to_string()
    })?;
    info!("Editor de prueba abierto");
    Ok(())
}
