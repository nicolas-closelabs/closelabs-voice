//! CloseLabs Voice — codificador **Ogg/Opus** para la subida a Groq Whisper.
//!
//! Por qué: el cuello de botella de la transcripción en la nube no es Groq (0,5 s) sino la
//! SUBIDA, y nuestros médicos están en clínicas de LatAm con internet malo. Opus a 24 kbps
//! deja el audio ~10x más chico que FLAC (que ya era ~2x más chico que WAV): un minuto de
//! dictado pasa de ~1,9 MB (WAV) / ~1 MB (FLAC) a ~180 KB. Con 1 Mbps de subida eso es la
//! diferencia entre esperar 15 s y esperar 1,5 s.
//!
//! Con pérdida, sí, pero es el códec diseñado para voz: a 24 kbps mono @16 kHz Whisper
//! transcribe igual (es lo que hace Aztec 1.8.2 en sus tres plataformas). Igual la ruta de
//! `groq_transcribe.rs` encadena Opus → FLAC → WAV, así que si algo fallara nunca quedamos
//! peor que antes.
//!
//! ⚠️ La razón por la que Opus estuvo descartado era de COMPILACIÓN, no de calidad: `audiopus`
//! construye libopus con autotools (`autoreconf`) → imposible en Windows MSVC. `opusic-sys`
//! lo construye con **cmake**, que ya tenemos como requisito (lo usa transcribe-cpp).
//!
//! El contenedor se arma a mano siguiendo el RFC 7845 (Ogg Encapsulation for Opus): página
//! `OpusHead`, página `OpusTags` y luego los paquetes de audio.

use std::ffi::c_int;

use ogg::writing::{PacketWriteEndInfo, PacketWriter};
use opusic_sys::{
    opus_encode_float, opus_encoder_create, opus_encoder_ctl, opus_encoder_destroy, OpusEncoder,
    OPUS_APPLICATION_VOIP, OPUS_GET_LOOKAHEAD_REQUEST, OPUS_OK, OPUS_SET_BITRATE_REQUEST,
    OPUS_SET_SIGNAL_REQUEST, OPUS_SIGNAL_VOICE,
};

/// Sample rate de nuestro grabador (mono f32). Opus solo admite 8/12/16/24/48 kHz.
const IN_RATE: usize = 16_000;
/// Opus trabaja por tramas; 20 ms es el tamaño estándar de voz (mejor relación tamaño/latencia).
const FRAME_SAMPLES: usize = IN_RATE / 1000 * 20; // 320
/// 24 kbps mono es transparente para voz. Subirlo no mejora el WER; bajarlo empieza a doler.
const BITRATE: i32 = 24_000;
/// Un paquete de 20 ms nunca pasa de ~250 bytes a 24 kbps; 4 KB es margen de sobra.
const MAX_PACKET: usize = 4_000;
/// Ogg cuenta el tiempo SIEMPRE en muestras de 48 kHz, sin importar el sample rate real.
const OGG_RATE_RATIO: u64 = 48_000 / IN_RATE as u64; // 3
const GRANULE_PER_FRAME: u64 = (FRAME_SAMPLES * OGG_RATE_RATIO as usize) as u64; // 960
/// Identificador del flujo lógico dentro del Ogg. Como solo hay uno, cualquier valor sirve.
const STREAM_SERIAL: u32 = 0xC105_E1AB;

/// Encoder de libopus con liberación garantizada (el puntero crudo viene de C).
struct Encoder(*mut OpusEncoder);

impl Drop for Encoder {
    fn drop(&mut self) {
        unsafe { opus_encoder_destroy(self.0) }
    }
}

impl Encoder {
    fn new() -> Result<Self, String> {
        let mut err: c_int = 0;
        let raw = unsafe {
            opus_encoder_create(
                IN_RATE as i32,
                1,
                OPUS_APPLICATION_VOIP,
                &mut err as *mut c_int,
            )
        };
        if raw.is_null() || err != OPUS_OK {
            return Err(format!("opus_encoder_create: código {err}"));
        }
        let enc = Encoder(raw);
        enc.ctl(OPUS_SET_BITRATE_REQUEST, BITRATE)?;
        // Le decimos que es voz para que priorice el modo SILK (mucho mejor a bitrate bajo).
        enc.ctl(OPUS_SET_SIGNAL_REQUEST, OPUS_SIGNAL_VOICE)?;
        Ok(enc)
    }

    fn ctl(&self, request: c_int, value: i32) -> Result<(), String> {
        let code = unsafe { opus_encoder_ctl(self.0, request, value) };
        if code != OPUS_OK {
            return Err(format!("opus_encoder_ctl({request}): código {code}"));
        }
        Ok(())
    }

    /// Muestras que el encoder se "come" al arrancar. El decodificador debe descartarlas para
    /// que el audio no empiece con un adelanto de silencio (campo `pre_skip` del RFC 7845).
    fn lookahead(&self) -> Result<u64, String> {
        let mut value: i32 = 0;
        let code =
            unsafe { opus_encoder_ctl(self.0, OPUS_GET_LOOKAHEAD_REQUEST, &mut value as *mut i32) };
        if code != OPUS_OK {
            return Err(format!("opus_encoder_ctl(lookahead): código {code}"));
        }
        Ok(value.max(0) as u64)
    }

    fn encode_frame(&self, frame: &[f32], out: &mut [u8]) -> Result<usize, String> {
        let written = unsafe {
            opus_encode_float(
                self.0,
                frame.as_ptr(),
                FRAME_SAMPLES as c_int,
                out.as_mut_ptr(),
                out.len() as i32,
            )
        };
        if written < 0 {
            return Err(format!("opus_encode_float: código {written}"));
        }
        Ok(written as usize)
    }
}

/// Cabecera `OpusHead` (RFC 7845 §5.1): 19 bytes, todo little-endian.
fn opus_head(pre_skip: u64) -> Vec<u8> {
    let mut head = Vec::with_capacity(19);
    head.extend_from_slice(b"OpusHead");
    head.push(1); // versión del encapsulado
    head.push(1); // canales: mono
    head.extend_from_slice(&(pre_skip as u16).to_le_bytes());
    head.extend_from_slice(&(IN_RATE as u32).to_le_bytes()); // sample rate original (informativo)
    head.extend_from_slice(&0i16.to_le_bytes()); // ganancia de salida: sin cambios
    head.push(0); // mapping family 0 = mono/estéreo simple
    head
}

/// Cabecera `OpusTags` (RFC 7845 §5.2): vendor string + lista vacía de comentarios.
fn opus_tags() -> Vec<u8> {
    const VENDOR: &[u8] = b"CloseLabs Voice";
    let mut tags = Vec::with_capacity(8 + 4 + VENDOR.len() + 4);
    tags.extend_from_slice(b"OpusTags");
    tags.extend_from_slice(&(VENDOR.len() as u32).to_le_bytes());
    tags.extend_from_slice(VENDOR);
    tags.extend_from_slice(&0u32.to_le_bytes()); // sin comentarios
    tags
}

/// Codifica `samples` (mono f32 @16 kHz) a un archivo **Ogg/Opus** en memoria.
pub fn encode_opus_ogg(samples: &[f32]) -> Result<Vec<u8>, String> {
    if samples.is_empty() {
        return Err("no hay audio que codificar".to_string());
    }
    let encoder = Encoder::new()?;
    let lookahead = encoder.lookahead()?;
    let pre_skip = lookahead * OGG_RATE_RATIO;

    // Rellenamos con silencio hasta completar tramas enteras, contando también el lookahead:
    // si no, la última página pediría más audio del que el flujo realmente contiene.
    let needed = samples.len() as u64 + lookahead;
    let frames = needed.div_ceil(FRAME_SAMPLES as u64) as usize;
    let mut padded = Vec::with_capacity(frames * FRAME_SAMPLES);
    padded.extend_from_slice(samples);
    padded.resize(frames * FRAME_SAMPLES, 0.0);

    let mut writer = PacketWriter::new(Vec::<u8>::new());
    // Las dos cabeceras van cada una en su propia página, como exige el RFC.
    writer
        .write_packet(
            opus_head(pre_skip),
            STREAM_SERIAL,
            PacketWriteEndInfo::EndPage,
            0,
        )
        .map_err(|e| format!("ogg OpusHead: {e}"))?;
    writer
        .write_packet(opus_tags(), STREAM_SERIAL, PacketWriteEndInfo::EndPage, 0)
        .map_err(|e| format!("ogg OpusTags: {e}"))?;

    // La posición final le dice al decodificador dónde cortar el relleno que acabamos de meter.
    let final_granule = pre_skip + samples.len() as u64 * OGG_RATE_RATIO;
    let mut buf = vec![0u8; MAX_PACKET];
    for (i, frame) in padded.chunks_exact(FRAME_SAMPLES).enumerate() {
        let len = encoder.encode_frame(frame, &mut buf)?;
        let last = i + 1 == frames;
        let granule = if last {
            final_granule
        } else {
            (i as u64 + 1) * GRANULE_PER_FRAME
        };
        let info = if last {
            PacketWriteEndInfo::EndStream
        } else {
            PacketWriteEndInfo::NormalPacket
        };
        writer
            .write_packet(buf[..len].to_vec(), STREAM_SERIAL, info, granule)
            .map_err(|e| format!("ogg paquete {i}: {e}"))?;
    }
    Ok(writer.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tono de voz sintético: una senoidal a 220 Hz, que es donde vive la voz humana.
    fn tone(secs: f32) -> Vec<f32> {
        let n = (IN_RATE as f32 * secs) as usize;
        (0..n)
            .map(|i| {
                let t = i as f32 / IN_RATE as f32;
                (t * 220.0 * std::f32::consts::TAU).sin() * 0.3
            })
            .collect()
    }

    #[test]
    fn produces_a_valid_ogg_opus_container() {
        let data = encode_opus_ogg(&tone(1.0)).expect("debe codificar");
        assert_eq!(&data[..4], b"OggS", "todo Ogg empieza con la firma OggS");
        // OpusHead va al comienzo de la primera página, tras la cabecera Ogg de 27+1 bytes.
        assert!(
            data.windows(8).any(|w| w == b"OpusHead"),
            "falta la cabecera OpusHead"
        );
        assert!(
            data.windows(8).any(|w| w == b"OpusTags"),
            "falta la cabecera OpusTags"
        );
    }

    #[test]
    fn is_far_smaller_than_the_raw_audio() {
        let samples = tone(10.0);
        let raw_wav_bytes = samples.len() * 2; // 16 bits por muestra
        let opus = encode_opus_ogg(&samples).expect("debe codificar");
        // A 24 kbps, 10 s son ~30 KB contra ~320 KB de WAV: al menos 5x más chico.
        assert!(
            opus.len() * 5 < raw_wav_bytes,
            "Opus pesó {} bytes contra {raw_wav_bytes} de WAV",
            opus.len()
        );
    }

    #[test]
    fn handles_audio_shorter_than_one_frame() {
        // Un dictado de 5 ms (toque accidental del atajo) no debe romper el encoder.
        let data = encode_opus_ogg(&tone(0.005)).expect("debe codificar");
        assert_eq!(&data[..4], b"OggS");
    }

    #[test]
    fn rejects_empty_audio() {
        assert!(encode_opus_ogg(&[]).is_err());
    }
}
