//! CloseLabs Voice — preparación del audio para subirlo a la nube.
//!
//! ⚠️ Este módulo YA NO habla con Groq. Desde la Fase 1 la app no conoce ninguna llave de
//! proveedor: manda el audio a nuestro proxy (`proxy.rs`), que decide a quién llamar. Aquí solo
//! queda lo que sigue siendo del cliente — comprimir el audio y armar la pista de vocabulario —
//! porque comprimir ANTES de subir es lo que hace tolerable el internet de una clínica.
//!
//! Optimización de velocidad (internet lento LatAm): subimos el audio comprimido en **Opus**
//! (~11x más chico que WAV, ~6x que FLAC; medido con un dictado clínico de 38 s: 1,23 MB →
//! 110 KB, con transcripción idéntica carácter por carácter). Red de seguridad en cadena: si
//! Groq rechazara el formato, se baja a FLAC y luego a WAV → nunca se regresa peor que antes.
//!
//! Calidad (benchmark Aztec 1.8.2): el diccionario del usuario viaja como `prompt` de Whisper
//! para que escriba bien fármacos, apellidos y marcas. Red: `connect_timeout` corto (sin
//! internet se cae a Parakeet en ~3 s, no en 60 s), timeout total proporcional al audio y un
//! reintento solo si falló la CONEXIÓN (errores rápidos, no reenvía uploads largos).

use std::io::Cursor;

use flacenc::bitsink::ByteSink;
use flacenc::component::BitRepr;
use flacenc::error::Verify;
use flacenc::source::MemSource;
use log::warn;

const IN_RATE: usize = 16_000; // sample rate de nuestro grabador (mono f32)

/// Groq limita el `prompt` de Whisper a 224 tokens. ~450 caracteres para las palabras del
/// usuario deja margen para la frase de estilo y para el español (tokens más cortos).
const PROMPT_MAX_CHARS: usize = 450;

/// Frase de estilo que encabeza la pista. El `prompt` de Whisper funciona como "contexto
/// previo": el modelo continúa en el mismo registro. Con esto escribe dictado clínico en
/// español y, sobre todo, **correos con arroba** — en pruebas reales devolvía
/// "nicolas.closelabs.co" cuando el médico dictaba "nicolas arroba closelabs punto co".
const STYLE_HINT: &str = "Dictado médico en español, con signos de puntuación y correos \
electrónicos escritos como maria.lopez@clinica.co.";

/// Pista para Whisper: frase de estilo + diccionario del usuario ("Metformina, Losartán…").
/// Respeta el orden del usuario y corta en palabra completa al llegar al límite.
pub fn build_whisper_prompt(words: &[String]) -> Option<String> {
    let mut prompt = String::new();
    for word in words.iter().map(|w| w.trim()).filter(|w| !w.is_empty()) {
        let sep = if prompt.is_empty() { "" } else { ", " };
        if prompt.chars().count() + sep.len() + word.chars().count() + 1 > PROMPT_MAX_CHARS {
            break;
        }
        prompt.push_str(sep);
        prompt.push_str(word);
    }
    if prompt.is_empty() {
        // Aunque el diccionario esté vacío, la frase de estilo sola ya mejora la escritura.
        return Some(STYLE_HINT.to_string());
    }
    prompt.push('.');
    Some(format!("{STYLE_HINT} {prompt}"))
}

/// Codifica los samples a un archivo **FLAC** en memoria (comprimido, sin pérdida).
fn encode_flac(samples: &[f32]) -> Result<Vec<u8>, String> {
    let pcm: Vec<i32> = samples
        .iter()
        .map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i32)
        .collect();
    let config = flacenc::config::Encoder::default()
        .into_verified()
        .map_err(|e| format!("flac config: {e:?}"))?;
    let source = MemSource::from_samples(&pcm, 1, 16, IN_RATE);
    let stream = flacenc::encode_with_fixed_block_size(&config, source, 4096)
        .map_err(|e| format!("flac encode: {e:?}"))?;
    let mut sink = ByteSink::new();
    stream
        .write(&mut sink)
        .map_err(|e| format!("flac write: {e:?}"))?;
    Ok(sink.as_slice().to_vec())
}

/// Codifica samples f32 mono @16kHz a WAV PCM int16 en memoria (fallback sin comprimir).
fn encode_wav_16k_mono(samples: &[f32]) -> Result<Vec<u8>, String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: IN_RATE as u32,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut cursor = Cursor::new(Vec::<u8>::new());
    {
        let mut writer =
            hound::WavWriter::new(&mut cursor, spec).map_err(|e| format!("wav init: {e}"))?;
        for &s in samples {
            let v = (s.clamp(-1.0, 1.0) * 32767.0) as i16;
            writer
                .write_sample(v)
                .map_err(|e| format!("wav write: {e}"))?;
        }
        writer
            .finalize()
            .map_err(|e| format!("wav finalize: {e}"))?;
    }
    Ok(cursor.into_inner())
}

/// Un formato de subida: cómo se codifica y cómo se anuncia en el multipart.
pub(crate) struct UploadFormat {
    pub(crate) label: &'static str,
    pub(crate) filename: &'static str,
    pub(crate) mime: &'static str,
    pub(crate) encode: fn(&[f32]) -> Result<Vec<u8>, String>,
}

/// Formatos en orden de preferencia: del más liviano al más universal. Se baja un escalón solo
/// si la codificación falla o si Groq rechaza el FORMATO; cualquier otro error corta la cadena
/// (no tiene sentido resubir el mismo audio si lo que falló fue la red o la autenticación).
/// El último, WAV, es la garantía de que nunca quedamos peor que antes de comprimir.
pub(crate) const UPLOAD_FORMATS: &[UploadFormat] = &[
    UploadFormat {
        label: "Opus",
        filename: "audio.ogg",
        mime: "audio/ogg",
        encode: crate::opus_encode::encode_opus_ogg,
    },
    UploadFormat {
        label: "FLAC",
        filename: "audio.flac",
        mime: "audio/flac",
        encode: encode_flac,
    },
    UploadFormat {
        label: "WAV",
        filename: "audio.wav",
        mime: "audio/wav",
        encode: encode_wav_16k_mono,
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    fn words(list: &[&str]) -> Vec<String> {
        list.iter().map(|w| w.to_string()).collect()
    }

    #[test]
    fn whisper_prompt_joins_words_in_user_order() {
        let prompt = build_whisper_prompt(&words(&["Metformina", " Losartán ", "", "Pérez"]))
            .expect("hay palabras");
        assert!(prompt.ends_with("Metformina, Losartán, Pérez."), "{prompt}");
        assert!(prompt.starts_with(STYLE_HINT));
    }

    #[test]
    fn whisper_prompt_keeps_style_hint_without_words() {
        assert_eq!(build_whisper_prompt(&[]).as_deref(), Some(STYLE_HINT));
        assert_eq!(
            build_whisper_prompt(&words(&["  "])).as_deref(),
            Some(STYLE_HINT)
        );
    }

    #[test]
    fn whisper_prompt_respects_char_limit() {
        let many: Vec<String> = (0..200).map(|i| format!("termino{i}")).collect();
        let prompt = build_whisper_prompt(&many).unwrap();
        assert!(prompt.chars().count() <= STYLE_HINT.chars().count() + PROMPT_MAX_CHARS + 1);
        assert!(prompt.ends_with('.'));
        assert!(prompt.contains("termino0, termino1"));
    }
}
