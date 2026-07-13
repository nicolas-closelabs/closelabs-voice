//! CloseLabs Voice — transcripción en la NUBE vía Groq Whisper (`whisper-large-v3-turbo`).
//!
//! Ruta PRINCIPAL de transcripción cuando hay internet (calidad alta en texto largo, como
//! Aztec). Si falla (offline, timeout, rate-limit), el llamador cae al Parakeet LOCAL.
//! ⚠️ En esta ruta el audio SÍ sale del equipo hacia Groq.
//!
//! Optimización de velocidad (internet lento LatAm): subimos el audio comprimido en **FLAC**
//! (~2x más chico que WAV; verificado que Groq lo acepta con 200 OK). `flacenc` es Rust puro
//! (cero C → compila en las 3 plataformas). Red de seguridad: si Groq rechazara el FLAC por
//! formato, **reintentamos con WAV** → nunca se regresa peor que antes.

use std::io::Cursor;
use std::time::Duration;

use flacenc::bitsink::ByteSink;
use flacenc::component::BitRepr;
use flacenc::error::Verify;
use flacenc::source::MemSource;
use log::{info, warn};

/// Modelo de transcripción en la nube. El mismo que usa Aztec: rápido y muy preciso.
pub const CLOUD_MODEL: &str = "whisper-large-v3-turbo";

const IN_RATE: usize = 16_000; // sample rate de nuestro grabador (mono f32)

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
        writer.finalize().map_err(|e| format!("wav finalize: {e}"))?;
    }
    Ok(cursor.into_inner())
}

/// Error de un intento de subida. `status` distingue un rechazo de FORMATO (reintentar con
/// WAV) de un error de red/auth (dejar caer al motor local).
struct PostErr {
    status: Option<u16>,
    msg: String,
}

async fn post_audio(
    base_url: &str,
    api_key: &str,
    model: &str,
    language: Option<&str>,
    bytes: Vec<u8>,
    filename: &str,
    mime: &str,
) -> Result<String, PostErr> {
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(filename.to_string())
        .mime_str(mime)
        .map_err(|e| PostErr {
            status: None,
            msg: format!("mime: {e}"),
        })?;
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
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| PostErr {
            status: None,
            msg: format!("client: {e}"),
        })?;

    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| PostErr {
            status: None,
            msg: format!("request: {e}"),
        })?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(PostErr {
            status: Some(status.as_u16()),
            msg: format!("groq {status}: {body}"),
        });
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| PostErr {
        status: None,
        msg: format!("json: {e}"),
    })?;
    Ok(json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Transcribe `samples` con Groq Whisper. Sube **FLAC** (comprimido); si Groq lo rechazara
/// por formato, **reintenta con WAV**. `language` opcional (`None` = auto, como Aztec).
pub async fn transcribe_audio_groq(
    base_url: &str,
    api_key: &str,
    model: &str,
    language: Option<&str>,
    samples: &[f32],
) -> Result<String, String> {
    // 1) Intento comprimido (FLAC).
    match encode_flac(samples) {
        Ok(flac) => {
            let kb = flac.len() / 1024;
            match post_audio(
                base_url, api_key, model, language, flac, "audio.flac", "audio/flac",
            )
            .await
            {
                Ok(text) => {
                    info!("Groq Whisper vía FLAC OK ({kb} KB subidos)");
                    return Ok(text);
                }
                Err(e) if matches!(e.status, Some(400) | Some(415) | Some(422)) => {
                    warn!("Groq rechazó el FLAC ({}); reintento con WAV", e.msg);
                }
                Err(e) => return Err(e.msg),
            }
        }
        Err(e) => warn!("Falló codificar FLAC ({e}); usando WAV"),
    }

    // 2) Fallback sin comprimir (WAV) — garantiza no ser peor que antes.
    let wav = encode_wav_16k_mono(samples)?;
    let kb = wav.len() / 1024;
    match post_audio(base_url, api_key, model, language, wav, "audio.wav", "audio/wav").await {
        Ok(text) => {
            info!("Groq Whisper vía WAV OK ({kb} KB subidos)");
            Ok(text)
        }
        Err(e) => Err(e.msg),
    }
}
