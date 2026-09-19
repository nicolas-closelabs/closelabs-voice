//! CloseLabs Voice — audio del último dictado, SOLO en memoria.
//!
//! Sirve para "Reprocesar último dictado": si la transcripción salió mal porque el internet se
//! cayó a mitad del dictado (y se resolvió con el Parakeet local), o porque el médico acababa de
//! agregar un término al diccionario, puede repetir el proceso sin volver a dictar. En una
//! consulta eso ahorra tener que pedirle al paciente que espere otra vez.
//!
//! ⚠️ **Nunca toca el disco.** El audio de un paciente no se persiste: vive en RAM y se pierde al
//! cerrar la app, igual que [`crate::last_transcript`]. Tampoco se acumula: cada dictado nuevo
//! reemplaza al anterior.

use once_cell::sync::Lazy;
use std::sync::Mutex;

/// Tope de audio guardado. A 16 kHz mono f32 son 4 bytes por muestra, así que cinco minutos
/// ocupan ~19 MB. Un dictado más largo que eso no se guarda: preferimos perder la opción de
/// reprocesar antes que dejar medio consultorio de audio en la memoria de un equipo débil.
const MAX_SAMPLES: usize = 16_000 * 60 * 5;

static LAST_RECORDING: Lazy<Mutex<Option<Vec<f32>>>> = Lazy::new(|| Mutex::new(None));

/// Guarda el audio del dictado recién terminado, reemplazando al anterior.
pub fn set(samples: &[f32]) {
    let Ok(mut last) = LAST_RECORDING.lock() else {
        return;
    };
    if samples.is_empty() || samples.len() > MAX_SAMPLES {
        // Un dictado demasiado largo deja el hueco vacío en vez de conservar el anterior: que el
        // atajo no haga nada es mucho mejor que reprocesar el dictado de otro paciente.
        *last = None;
        return;
    }
    *last = Some(samples.to_vec());
}

/// Audio del último dictado, si todavía lo tenemos.
pub fn get() -> Option<Vec<f32>> {
    LAST_RECORDING.lock().ok().and_then(|last| last.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::MutexGuard;

    /// Los tests comparten el estado global, así que se serializan entre ellos.
    static GUARD: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));
    fn lock() -> MutexGuard<'static, ()> {
        GUARD.lock().unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn keeps_the_last_recording() {
        let _g = lock();
        set(&[0.1, 0.2, 0.3]);
        assert_eq!(get(), Some(vec![0.1, 0.2, 0.3]));
    }

    #[test]
    fn a_new_recording_replaces_the_previous_one() {
        let _g = lock();
        set(&[0.1]);
        set(&[0.9, 0.8]);
        assert_eq!(get(), Some(vec![0.9, 0.8]));
    }

    #[test]
    fn forgets_instead_of_keeping_stale_audio() {
        let _g = lock();
        set(&[0.1]);
        set(&[]); // dictado vacío
        assert_eq!(get(), None, "no debe quedar el audio del dictado anterior");

        set(&[0.1]);
        set(&vec![0.0; MAX_SAMPLES + 1]); // dictado larguísimo
        assert_eq!(get(), None, "no debe quedar el audio del dictado anterior");
    }
}
