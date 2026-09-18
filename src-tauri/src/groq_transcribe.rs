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
//!
//! Calidad (benchmark Aztec 1.8.2): el diccionario del usuario viaja como `prompt` de Whisper
//! para que escriba bien fármacos, apellidos y marcas. Red: `connect_timeout` corto (sin
//! internet se cae a Parakeet en ~3 s, no en 60 s), timeout total proporcional al audio y un
//! reintento solo si falló la CONEXIÓN (errores rápidos, no reenvía uploads largos).

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

/// Groq limita el `prompt` de Whisper a 224 tokens. ~450 caracteres para las palabras del
/// usuario deja margen para la frase de estilo y para el español (tokens más cortos).
const PROMPT_MAX_CHARS: usize = 450;
/// Tiempo máximo para abrir la conexión. Offline o red caída → fallback local rápido.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);

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

/// Timeout total de la petición: base + medio segundo por cada segundo de audio (subidas
/// lentas en LatAm), con tope para no dejar al médico esperando indefinidamente.
fn request_timeout(samples: usize) -> Duration {
    let audio_secs = samples as u64 / IN_RATE as u64;
    Duration::from_secs((15 + audio_secs / 2).min(120))
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

/// Error de un intento de subida. `status` distingue un rechazo de FORMATO (reintentar con
/// WAV) de un error de red/auth (dejar caer al motor local). `connect` marca que ni siquiera
/// se pudo abrir la conexión (vale la pena un reintento rápido).
struct PostErr {
    status: Option<u16>,
    connect: bool,
    msg: String,
}

/// Petición a Groq ya armada (salvo el archivo, que se consume en cada intento).
struct AudioRequest<'a> {
    base_url: &'a str,
    api_key: &'a str,
    model: &'a str,
    language: Option<&'a str>,
    prompt: Option<&'a str>,
    timeout: Duration,
}

async fn post_audio(
    req: &AudioRequest<'_>,
    bytes: Vec<u8>,
    filename: &str,
    mime: &str,
) -> Result<String, PostErr> {
    let part = reqwest::multipart::Part::bytes(bytes)
        .file_name(filename.to_string())
        .mime_str(mime)
        .map_err(|e| PostErr {
            status: None,
            connect: false,
            msg: format!("mime: {e}"),
        })?;
    let mut form = reqwest::multipart::Form::new()
        .part("file", part)
        .text("model", req.model.to_string())
        .text("response_format", "json".to_string())
        .text("temperature", "0".to_string());
    if let Some(lang) = req.language {
        form = form.text("language", lang.to_string());
    }
    if let Some(prompt) = req.prompt {
        form = form.text("prompt", prompt.to_string());
    }

    let url = format!(
        "{}/audio/transcriptions",
        req.base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(req.timeout)
        .build()
        .map_err(|e| PostErr {
            status: None,
            connect: false,
            msg: format!("client: {e}"),
        })?;

    let resp = client
        .post(&url)
        .bearer_auth(req.api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| PostErr {
            status: None,
            connect: e.is_connect(),
            msg: format!("request: {e}"),
        })?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(PostErr {
            status: Some(status.as_u16()),
            connect: false,
            msg: format!("groq {status}: {body}"),
        });
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| PostErr {
        status: None,
        connect: false,
        msg: format!("json: {e}"),
    })?;
    Ok(json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string())
}

/// Un intento con un único reintento si falló al CONECTAR (red intermitente). Timeouts y
/// errores HTTP no se reintentan: el llamador cae a Parakeet sin hacer esperar más.
async fn post_audio_with_retry(
    req: &AudioRequest<'_>,
    bytes: Vec<u8>,
    filename: &str,
    mime: &str,
) -> Result<String, PostErr> {
    match post_audio(req, bytes.clone(), filename, mime).await {
        Err(e) if e.connect => {
            warn!("Groq: fallo de conexión ({}); reintentando una vez", e.msg);
            post_audio(req, bytes, filename, mime).await
        }
        other => other,
    }
}

/// Transcribe `samples` con Groq Whisper. Sube **FLAC** (comprimido); si Groq lo rechazara
/// por formato, **reintenta con WAV**. `language` opcional (`None` = auto, como Aztec).
/// `prompt` = pista de vocabulario (ver [`build_whisper_prompt`]).
pub async fn transcribe_audio_groq(
    base_url: &str,
    api_key: &str,
    model: &str,
    language: Option<&str>,
    prompt: Option<&str>,
    samples: &[f32],
) -> Result<String, String> {
    let req = AudioRequest {
        base_url,
        api_key,
        model,
        language,
        prompt,
        timeout: request_timeout(samples.len()),
    };

    // 1) Intento comprimido (FLAC).
    match encode_flac(samples) {
        Ok(flac) => {
            let kb = flac.len() / 1024;
            match post_audio_with_retry(&req, flac, "audio.flac", "audio/flac").await {
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
    match post_audio_with_retry(&req, wav, "audio.wav", "audio/wav").await {
        Ok(text) => {
            info!("Groq Whisper vía WAV OK ({kb} KB subidos)");
            Ok(text)
        }
        Err(e) => Err(e.msg),
    }
}

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
        assert_eq!(build_whisper_prompt(&words(&["  "])).as_deref(), Some(STYLE_HINT));
    }

    #[test]
    fn whisper_prompt_respects_char_limit() {
        let many: Vec<String> = (0..200).map(|i| format!("termino{i}")).collect();
        let prompt = build_whisper_prompt(&many).unwrap();
        assert!(prompt.chars().count() <= STYLE_HINT.chars().count() + PROMPT_MAX_CHARS + 1);
        assert!(prompt.ends_with('.'));
        assert!(prompt.contains("termino0, termino1"));
    }

    #[test]
    fn request_timeout_grows_with_audio_and_is_capped() {
        assert_eq!(request_timeout(0), Duration::from_secs(15));
        assert_eq!(request_timeout(IN_RATE * 60), Duration::from_secs(45));
        assert_eq!(request_timeout(IN_RATE * 3600), Duration::from_secs(120));
    }
}
