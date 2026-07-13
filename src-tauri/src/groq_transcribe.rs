//! CloseLabs Voice — transcripción en la NUBE vía Groq Whisper (`whisper-large-v3-turbo`).
//!
//! Es la ruta PRINCIPAL de transcripción cuando hay internet (calidad alta en texto
//! largo, igual que Aztec Voice). Si falla (offline, timeout, rate-limit, error), el
//! llamador cae al Parakeet LOCAL como respaldo. ⚠️ En esta ruta el audio SÍ sale del
//! equipo hacia Groq (a diferencia del Parakeet local). Groq expone un endpoint
//! compatible con OpenAI: `POST {base_url}/audio/transcriptions` (multipart/form-data).
//!
//! Este módulo es un helper puro (WAV en memoria + HTTP); el gating (habilitado, key,
//! idioma, online) lo decide `actions.rs`.

use std::io::Cursor;

/// Modelo de transcripción en la nube. El mismo que usa Aztec: rápido y muy preciso.
pub const CLOUD_MODEL: &str = "whisper-large-v3-turbo";

/// Codifica samples f32 mono @16kHz (lo que produce nuestro grabador) a un WAV PCM
/// int16 en memoria, listo para subir como `file` en el multipart.
fn encode_wav_16k_mono(samples: &[f32]) -> Result<Vec<u8>, String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16_000,
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
        writer.finalize().map_err(|e| format!("wav finalize: {e}"))?;
    }
    Ok(cursor.into_inner())
}

/// Transcribe `samples` con Groq Whisper. `language` es opcional: `None` = auto-detección
/// (como Aztec); `Some("es")` la fuerza. Devuelve el texto crudo o un error (para caer al
/// motor local).
pub async fn transcribe_audio_groq(
    base_url: &str,
    api_key: &str,
    model: &str,
    language: Option<&str>,
    samples: &[f32],
) -> Result<String, String> {
    let wav = encode_wav_16k_mono(samples)?;

    let part = reqwest::multipart::Part::bytes(wav)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("multipart mime: {e}"))?;

    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", model.to_string())
        .text("response_format", "json".to_string())
        .text("temperature", "0".to_string());
    if let Some(lang) = language {
        form = form.text("language", lang.to_string());
    }

    let url = format!("{}/audio/transcriptions", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("client build: {e}"))?;

    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("request: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("groq {status}: {body}"));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse json: {e}"))?;
    let text = json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    Ok(text)
}
