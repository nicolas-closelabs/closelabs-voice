//! CloseLabs Voice — último dictado, SOLO en memoria.
//!
//! No guardamos historial ni audio en disco (privacidad del paciente), pero la bandeja necesita
//! "Copiar/Pegar última transcripción" para rescatar un pegado que cayó en la ventana
//! equivocada. Se pierde al cerrar la app.

use once_cell::sync::Lazy;
use std::sync::Mutex;

static LAST_TRANSCRIPT: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));

pub fn set(text: &str) {
    if let Ok(mut last) = LAST_TRANSCRIPT.lock() {
        *last = Some(text.to_string());
    }
}

pub fn get() -> Option<String> {
    LAST_TRANSCRIPT
        .lock()
        .ok()
        .and_then(|last| last.clone())
        .filter(|text| !text.trim().is_empty())
}
