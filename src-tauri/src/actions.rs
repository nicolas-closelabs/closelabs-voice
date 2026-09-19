use crate::audio_feedback::{play_feedback_sound, play_feedback_sound_blocking, SoundType};
use crate::audio_toolkit::text::is_whisper_hallucination;
use crate::audio_toolkit::{apply_custom_words, filter_transcription_output};
use crate::audio_toolkit::{is_microphone_access_denied, is_no_input_device_error, VadPolicy};
use crate::managers::audio::AudioRecordingManager;
use crate::managers::history::HistoryManager;
use crate::managers::model::ModelManager;
use crate::managers::transcription::StreamWorkKind;
use crate::managers::transcription::TranscriptionManager;
use crate::settings::{get_settings, AppSettings, OverlayStyle};
use crate::shortcut;
use crate::tray::{change_tray_icon, TrayIconState};
use crate::utils::{
    self, show_processing_overlay, show_recording_overlay, show_transcribing_overlay,
};
use crate::TranscriptionCoordinator;
use ferrous_opencc::{config::BuiltinConfig, OpenCC};
use log::{debug, error, warn};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::Manager;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
struct RecordingErrorEvent {
    error_type: String,
    detail: Option<String>,
}

/// Drop guard that notifies the [`TranscriptionCoordinator`] when the
/// transcription pipeline finishes — whether it completes normally or panics.
struct FinishGuard(AppHandle);
impl Drop for FinishGuard {
    fn drop(&mut self) {
        if let Some(c) = self.0.try_state::<TranscriptionCoordinator>() {
            c.notify_processing_finished();
        }
    }
}

// Shortcut Action Trait
pub trait ShortcutAction: Send + Sync {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str);
}

// Transcribe Action
struct TranscribeAction {
    post_process: bool,
}

/// Strip invisible Unicode characters that some LLMs may insert
fn strip_invisible_chars(s: &str) -> String {
    s.replace(['\u{200B}', '\u{200C}', '\u{200D}', '\u{FEFF}'], "")
}

/// Build a system prompt from the user's prompt template.
/// Removes `${output}` placeholder since the transcription is sent as the user message.
fn build_system_prompt(prompt_template: &str) -> String {
    prompt_template.replace("${output}", "").trim().to_string()
}

/// Returns `true` when a transcription has no meaningful content to
/// post-process (empty or whitespace-only). Used to skip the post-processing
/// LLM call when nothing was actually transcribed, which would otherwise make
/// the model reply with an error message such as "you need to provide the
/// transcription".
fn is_blank_transcription(transcription: &str) -> bool {
    transcription.trim().is_empty()
}

/// CloseLabs Voice: intenta transcribir en la NUBE con Groq Whisper (ruta principal
/// online). Devuelve `Some(texto)` si funciona; `None` para que el llamador caiga al
/// Parakeet LOCAL (offline, sin key, deshabilitado, o cualquier error de red/API).
/// ⚠️ En esta ruta el audio SÍ sale del equipo hacia Groq.
async fn try_cloud_transcription(app: &tauri::AppHandle, samples: &[f32]) -> Option<String> {
    let settings = get_settings(app);
    if !settings.cloud_transcription_enabled {
        return None;
    }
    // Idioma: "auto" (default, como Aztec) → None, para que Whisper lo detecte.
    let language = match settings.selected_language.as_str() {
        "auto" | "" => None,
        other => Some(other.to_string()),
    };
    // El diccionario viaja como pista de vocabulario. El servidor la descarta si el proveedor de
    // turno no la soporta — ver la nota sobre el truncado silencioso en `proxy.rs`.
    let prompt = crate::groq_transcribe::build_whisper_prompt(&settings.custom_words);
    match prompt.as_deref() {
        Some(p) => debug!(
            "Pista de vocabulario para Whisper: {} palabras, {} chars",
            settings
                .custom_words
                .iter()
                .filter(|w| !w.trim().is_empty())
                .count(),
            p.chars().count()
        ),
        None => debug!("Sin pista de vocabulario (diccionario vacío)"),
    }

    match crate::proxy::transcribe_with_fallback(
        app,
        samples,
        language.as_deref(),
        prompt.as_deref(),
    )
    .await
    {
        Ok(text) if is_whisper_hallucination(&text, prompt.as_deref()) => {
            // Era silencio o ruido: no hay nada que pegar, y tampoco tiene sentido reintentar
            // con Parakeet sobre el mismo audio.
            warn!("Transcripción descartada: alucinación conocida de Whisper");
            Some(String::new())
        }
        Ok(text) if !text.trim().is_empty() => {
            debug!(
                "Transcripción en la nube OK: {} chars",
                text.chars().count()
            );
            // El diccionario se aplica TAMBIÉN al texto de la nube: la pista solo *sugiere* el
            // vocabulario, y en pruebas reales devolvía "Icetotrinoina" teniendo "Isotetrinoina"
            // en el diccionario. Esta corrección por similitud es local y determinista.
            let corrected = apply_custom_words(
                &text,
                &settings.custom_words,
                settings.word_correction_threshold,
            );
            if corrected != text {
                debug!("Diccionario aplicado al texto de la nube");
            }
            Some(filter_transcription_output(
                &corrected,
                &settings.app_language,
                &settings.custom_filler_words,
            ))
        }
        Ok(_) => {
            warn!("Transcripción en la nube vacía; fallback a Parakeet local");
            None
        }
        Err(code) => {
            // `code` es nuestro vocabulario cerrado ('rate_limit', 'quota_exceeded', 'timeout'…),
            // nunca el mensaje del proveedor, que podría traer eco del dictado.
            warn!("Transcripción en la nube falló ({code}); fallback a Parakeet local");
            None
        }
    }
}

/// `true` si el error viene de no tener red (no de la API). Offline, reintentar es tiempo
/// perdido: se pega la transcripción cruda y listo.
fn is_offline_error(message: &str) -> bool {
    let m = message.to_lowercase();
    m.contains("error sending request")
        || m.contains("dns error")
        || m.contains("connection refused")
        || m.contains("network is unreachable")
        || m.contains("proxy unreachable")
}

/// `true` si el intento se agotó por tiempo. Reintentar entonces DUPLICA la espera del médico
/// (dos veces el timeout) para volver a caer en lo mismo: mejor pegar el texto crudo ya.
fn is_timeout_error(message: &str) -> bool {
    let m = message.to_lowercase();
    m.contains("timed out") || m.contains("timeout") || m.contains("operation timed out")
}

/// Limpia el dictado (puntuación, muletillas, formato) pasando por NUESTRO proxy.
///
/// Ya no conoce proveedores ni modelos: eso lo decide el servidor leyendo una tabla. Lo que sí
/// se queda aquí son las guardas, porque protegen al médico del modelo y deben correr aunque el
/// servidor cambie de proveedor: no refinar dictados de dos palabras, y descartar una salida que
/// se inventó cosas, se negó a responder o repitió el prompt.
async fn post_process_transcription(
    app: &AppHandle,
    settings: &AppSettings,
    transcription: &str,
) -> Option<String> {
    if is_blank_transcription(transcription) {
        debug!("Refine omitido: la transcripción está vacía");
        return None;
    }
    if !crate::refine_guard::should_refine(transcription) {
        debug!("Refine omitido: dictado demasiado corto");
        return None;
    }

    let selected_prompt_id = settings.post_process_selected_prompt_id.as_deref()?;
    let prompt_template = settings
        .post_process_prompts
        .iter()
        .find(|p| p.id == selected_prompt_id)
        .map(|p| p.prompt.clone())?;
    let system_prompt = build_system_prompt(&prompt_template);

    let mut response = crate::proxy::format(app, transcription, &system_prompt).await;

    if let Err(code) = &response {
        // Sin conexión o agotado el tiempo, reintentar solo hace esperar más al médico para
        // volver a fallar: se pega el texto crudo, que es lo que ya tenemos.
        if is_timeout_error(code) || is_offline_error(code) {
            warn!("Refine omitido ({code}); se pega la transcripción cruda");
            return None;
        }
        // El cupo agotado y el límite del proveedor tampoco se arreglan reintentando al instante.
        if code == "quota_exceeded" || code == "rate_limit" {
            warn!("Refine omitido ({code}); se pega la transcripción cruda");
            return None;
        }
        warn!("Refine: primer intento falló ({code}); reintentando una vez");
        response = crate::proxy::format(app, transcription, &system_prompt).await;
    }

    let cleaned = match response {
        Ok(text) => strip_invisible_chars(&text),
        Err(code) => {
            warn!("Refine falló ({code}); se pega la transcripción cruda");
            return None;
        }
    };

    if let Some(reason) =
        crate::refine_guard::rejection_reason(transcription, &cleaned, &prompt_template)
    {
        warn!("Refine descartado ({reason}); se usa la transcripción cruda");
        return None;
    }

    debug!("Refine OK: {} chars", cleaned.chars().count());
    Some(cleaned)
}

async fn maybe_convert_chinese_variant(
    effective_language: &str,
    transcription: &str,
) -> Option<String> {
    // Gate on the language the model actually transcribed in (the effective
    // language), not the persisted intent. A leftover zh-Hans/zh-Hant intent
    // from a previously selected model must not run OpenCC S2T/T2S over output a
    // non-Chinese model produced — that would silently rewrite any shared CJK
    // characters (e.g. Japanese kanji) in the result.
    let is_simplified = effective_language == "zh-Hans";
    let is_traditional = effective_language == "zh-Hant";

    if !is_simplified && !is_traditional {
        debug!("effective language is not Simplified or Traditional Chinese; skipping conversion");
        return None;
    }

    debug!(
        "Starting Chinese variant conversion using OpenCC for language: {}",
        effective_language
    );

    // Use OpenCC to convert based on selected language
    let config = if is_simplified {
        // Convert Traditional Chinese to Simplified Chinese
        BuiltinConfig::Tw2sp
    } else {
        // Convert Simplified Chinese to Traditional Chinese
        BuiltinConfig::S2tw
    };

    match OpenCC::from_config(config) {
        Ok(converter) => {
            let converted = converter.convert(transcription);
            debug!(
                "OpenCC translation completed. Input length: {}, Output length: {}",
                transcription.len(),
                converted.len()
            );
            Some(converted)
        }
        Err(e) => {
            error!("Failed to initialize OpenCC converter: {}. Falling back to original transcription.", e);
            None
        }
    }
}

pub(crate) struct ProcessedTranscription {
    pub final_text: String,
    pub post_processed_text: Option<String>,
    pub post_process_prompt: Option<String>,
}

/// Resolve the persisted language *intent* into the language the currently-loaded
/// model will actually use — the same capability-aware coercion the transcription
/// paths apply (see [`crate::managers::model::effective_language`]). Post-processing
/// resolves it independently so it agrees with the language the transcription ran
/// in, without threading a value through the pipeline.
fn resolve_effective_language(app: &AppHandle, settings: &AppSettings) -> String {
    let tm = app.state::<Arc<TranscriptionManager>>();
    let model_manager = app.state::<Arc<ModelManager>>();
    let active_model = tm
        .get_current_model()
        .unwrap_or_else(|| settings.selected_model.clone());
    match model_manager.get_model_info(&active_model) {
        Some(info) => crate::managers::model::effective_language(
            &settings.selected_language,
            &info.supported_languages,
            info.supports_language_detection,
        ),
        None => settings.selected_language.clone(),
    }
}

pub(crate) async fn process_transcription_output(
    app: &AppHandle,
    transcription: &str,
    post_process: bool,
) -> ProcessedTranscription {
    let settings = get_settings(app);
    let mut final_text = transcription.to_string();
    let mut post_processed_text: Option<String> = None;
    let mut post_process_prompt: Option<String> = None;

    // Resolve the language the transcription actually ran in (the persisted
    // intent coerced against the loaded model's capabilities) so OpenCC keys off
    // the effective language rather than a possibly-stale intent.
    let effective_language = resolve_effective_language(app, &settings);
    if let Some(converted_text) =
        maybe_convert_chinese_variant(&effective_language, transcription).await
    {
        final_text = converted_text;
    }

    // Emails y URLs dictados ("juan arroba gmail punto com" → juan@gmail.com). Es local y
    // determinista, así que también arregla el texto cuando no hay internet para el refine.
    let normalized =
        crate::audio_toolkit::spoken_text::normalize_spoken_emails_and_urls(&final_text);
    if normalized != final_text {
        debug!("Emails/URLs dictados normalizados");
        final_text = normalized;
    }

    if post_process {
        if let Some(processed_text) = post_process_transcription(app, &settings, &final_text).await
        {
            post_processed_text = Some(processed_text.clone());
            final_text = processed_text;

            if let Some(prompt_id) = &settings.post_process_selected_prompt_id {
                if let Some(prompt) = settings
                    .post_process_prompts
                    .iter()
                    .find(|prompt| &prompt.id == prompt_id)
                {
                    post_process_prompt = Some(prompt.prompt.clone());
                }
            }
        }
    } else if final_text != transcription {
        post_processed_text = Some(final_text.clone());
    }

    ProcessedTranscription {
        final_text,
        post_processed_text,
        post_process_prompt,
    }
}

impl ShortcutAction for TranscribeAction {
    fn start(&self, app: &AppHandle, binding_id: &str, _shortcut_str: &str) {
        let start_time = Instant::now();
        debug!("TranscribeAction::start called for binding: {}", binding_id);

        // Load model in the background
        let tm = app.state::<Arc<TranscriptionManager>>();
        let rm = app.state::<Arc<AudioRecordingManager>>();

        // Load ASR model and VAD model in parallel
        let kickoff_started = Instant::now();
        tm.initiate_model_load();
        let rm_clone = Arc::clone(&rm);
        std::thread::spawn(move || {
            if let Err(e) = rm_clone.preload_vad() {
                debug!("VAD pre-load failed: {}", e);
            }
        });
        let kickoff_elapsed = kickoff_started.elapsed();

        let binding_id = binding_id.to_string();
        let tray_started = Instant::now();
        change_tray_icon(app, TrayIconState::Recording);
        let tray_elapsed = tray_started.elapsed();

        // Get the microphone mode to determine audio feedback timing
        let plan_started = Instant::now();
        let settings = get_settings(app);
        let is_always_on = settings.always_on_microphone;

        let selected_model_info = app
            .state::<Arc<ModelManager>>()
            .get_model_info(&settings.selected_model);

        // Use the app-facing model capability as the single pre-recording source
        // for live streaming decisions. Unknown support is represented as false
        // until the model registry is updated by discovery or runtime load.
        let model_supports_streaming = selected_model_info
            .as_ref()
            .map(|m| m.supports_streaming)
            .unwrap_or(false);
        let vad_policy = if !settings.vad_enabled {
            VadPolicy::Disabled
        } else if model_supports_streaming {
            VadPolicy::Streaming
        } else {
            VadPolicy::Offline
        };
        if model_supports_streaming {
            tm.start_stream();
        }
        let plan_elapsed = plan_started.elapsed();

        // Sizing the overlay follows the same advertised capability. A model that
        // doesn't stream (or whose capability is not known yet) gets the compact
        // pill instead of an oversized transparent live window.
        let overlay_started = Instant::now();
        match settings.overlay_style {
            OverlayStyle::Live if model_supports_streaming => utils::show_streaming_overlay(app),
            OverlayStyle::Live | OverlayStyle::Minimal => show_recording_overlay(app),
            OverlayStyle::None => {} // show_overlay_state no-ops on None anyway
        }
        // Everything above runs before capture can begin, so each span here is
        // added keypress->capture latency.
        debug!(
            "start-path pre-recording steps: model_kickoff={:?} tray={:?} settings+stream_plan={:?} overlay={:?}",
            kickoff_elapsed,
            tray_elapsed,
            plan_elapsed,
            overlay_started.elapsed()
        );
        debug!("Microphone mode - always_on: {}", is_always_on);

        let mut recording_error: Option<String> = None;
        if is_always_on {
            // Always-on mode: Play audio feedback immediately, then apply mute after sound finishes
            debug!("Always-on mode: Playing audio feedback immediately");
            let rm_clone = Arc::clone(&rm);
            let app_clone = app.clone();
            // The blocking helper exits immediately if audio feedback is disabled,
            // so we can always reuse this thread to ensure mute happens right after playback.
            std::thread::spawn(move || {
                play_feedback_sound_blocking(&app_clone, SoundType::Start);
                rm_clone.apply_mute();
            });

            if let Err(e) = rm.try_start_recording(&binding_id, vad_policy) {
                debug!("Recording failed: {}", e);
                recording_error = Some(e);
            }
        } else {
            // On-demand mode: Start recording first, then play audio feedback, then apply mute
            // This allows the microphone to be activated before playing the sound
            debug!("On-demand mode: Starting recording first, then audio feedback");
            let recording_start_time = Instant::now();
            match rm.try_start_recording(&binding_id, vad_policy) {
                Ok(()) => {
                    debug!("Recording started in {:?}", recording_start_time.elapsed());
                    // Small delay to ensure microphone stream is active
                    let app_clone = app.clone();
                    let rm_clone = Arc::clone(&rm);
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        debug!("Handling delayed audio feedback/mute sequence");
                        // Helper handles disabled audio feedback by returning early, so we reuse it
                        // to keep mute sequencing consistent in every mode.
                        play_feedback_sound_blocking(&app_clone, SoundType::Start);
                        rm_clone.apply_mute();
                    });
                }
                Err(e) => {
                    debug!("Failed to start recording: {}", e);
                    recording_error = Some(e);
                }
            }
        }

        if recording_error.is_none() {
            // Dynamically register the cancel shortcut in a separate task to avoid deadlock
            shortcut::register_cancel_shortcut(app);
        } else {
            // Starting failed (for example due to blocked microphone permissions).
            // Revert UI state so we don't stay stuck in the recording overlay.
            tm.cancel_stream();
            utils::hide_recording_overlay(app);
            change_tray_icon(app, TrayIconState::Idle);
            if let Some(err) = recording_error {
                let error_type = if is_microphone_access_denied(&err) {
                    "microphone_permission_denied"
                } else if is_no_input_device_error(&err) {
                    "no_input_device"
                } else {
                    "unknown"
                };
                let _ = app.emit(
                    "recording-error",
                    RecordingErrorEvent {
                        error_type: error_type.to_string(),
                        detail: Some(err),
                    },
                );
            }
        }

        debug!(
            "TranscribeAction::start completed in {:?}",
            start_time.elapsed()
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, _shortcut_str: &str) {
        // Unregister the cancel shortcut when transcription stops
        shortcut::unregister_cancel_shortcut(app);

        let stop_time = Instant::now();
        debug!("TranscribeAction::stop called for binding: {}", binding_id);

        let ah = app.clone();
        let rm = Arc::clone(&app.state::<Arc<AudioRecordingManager>>());
        let tm = Arc::clone(&app.state::<Arc<TranscriptionManager>>());
        // CloseLabs Voice: no se persiste historial ni audio; se conserva el binding por
        // si el manager se reutiliza, pero no se invoca guardado.
        let _hm = Arc::clone(&app.state::<Arc<HistoryManager>>());

        change_tray_icon(app, TrayIconState::Transcribing);
        // Stop should give immediate visual feedback. Live streaming can keep
        // the larger panel, but it still switches from listening to a working
        // spinner while the stream finalizes. Non-streaming paths use the
        // compact transcribing pill (None no-ops in show_*).
        let style = get_settings(app).overlay_style;
        match (style, tm.is_streaming()) {
            (OverlayStyle::Live, true) => {
                tm.emit_stream_working(StreamWorkKind::Transcribing);
            }
            _ => show_transcribing_overlay(app),
        }

        // Unmute before playing audio feedback so the stop sound is audible
        rm.remove_mute();

        // Play audio feedback for recording stop
        play_feedback_sound(app, SoundType::Stop);

        let binding_id = binding_id.to_string(); // Clone binding_id for the async task
                                                 // CloseLabs Voice: el refine (limpieza) va SIEMPRE que esté activado globalmente
                                                 // (post_process_enabled=true por defecto), sin importar por cuál atajo se dictó.
                                                 // Handy tenía dos atajos (crudo vs. con post-proceso); aquí el atajo principal
                                                 // también refina, que es lo que espera el médico.
        let post_process = self.post_process || get_settings(app).post_process_enabled;
        let cancel_generation = rm.cancel_generation();

        tauri::async_runtime::spawn(async move {
            let _guard = FinishGuard(ah.clone());
            debug!(
                "Starting async transcription task for binding: {}",
                binding_id
            );

            let stop_recording_time = Instant::now();
            if let Some(samples) = rm.stop_recording(&binding_id, cancel_generation) {
                debug!(
                    "Recording stopped and samples retrieved in {:?}, sample count: {}",
                    stop_recording_time.elapsed(),
                    samples.len()
                );

                if rm.was_cancelled_since(cancel_generation) {
                    debug!("Transcription operation cancelled after recording stop");
                    tm.cancel_stream();
                    utils::hide_recording_overlay(&ah);
                    change_tray_icon(&ah, TrayIconState::Idle);
                    return;
                }

                if samples.is_empty() {
                    debug!("Recording produced no audio samples; skipping persistence");
                    // Tear down any streaming worker so its channel doesn't leak
                    // and block the next start_stream.
                    tm.cancel_stream();
                    utils::hide_recording_overlay(&ah);
                    change_tray_icon(&ah, TrayIconState::Idle);
                } else {
                    // Solo en RAM, para el atajo "reprocesar último dictado". Va antes de
                    // transcribir porque `tm.transcribe` consume los samples.
                    crate::last_recording::set(&samples);

                    // CloseLabs Voice: NO se guarda el audio (.wav) ni el historial —
                    // privacidad del paciente + no gastar memoria. Solo se transcribe y se
                    // pega el texto. Si había un stream en vivo, se finaliza y se usa su
                    // texto; si no, se transcribe el lote de samples.
                    let transcription_time = Instant::now();
                    let transcription_result = match tm.finalize_stream() {
                        Ok(Some(text)) if !text.trim().is_empty() => Ok(text),
                        // CloseLabs Voice: transcripción HÍBRIDA (como Aztec). Online →
                        // Groq Whisper (nube, mejor en texto largo); si falla u offline →
                        // Parakeet local. ⚠️ En la ruta de nube el audio SÍ sale a Groq.
                        Ok(_) => match try_cloud_transcription(&ah, &samples).await {
                            Some(text) => Ok(text),
                            None => tm.transcribe(samples).map(|text| {
                                if is_whisper_hallucination(&text, None) {
                                    warn!("Transcripción local descartada: alucinación conocida");
                                    String::new()
                                } else {
                                    text
                                }
                            }),
                        },
                        Err(err) => Err(err),
                    };

                    if rm.was_cancelled_since(cancel_generation) {
                        debug!("Transcription operation cancelled before output handling");
                        utils::hide_recording_overlay(&ah);
                        change_tray_icon(&ah, TrayIconState::Idle);
                        return;
                    }

                    match transcription_result {
                        Ok(transcription) => {
                            // Privacidad: nunca escribir el texto dictado en el log.
                            debug!(
                                "Transcription completed in {:?}: {} chars",
                                transcription_time.elapsed(),
                                transcription.chars().count()
                            );

                            if post_process {
                                if style == OverlayStyle::Live {
                                    tm.emit_stream_working(StreamWorkKind::Polishing);
                                } else {
                                    show_processing_overlay(&ah);
                                }
                            }
                            let processed =
                                process_transcription_output(&ah, &transcription, post_process)
                                    .await;

                            if rm.was_cancelled_since(cancel_generation) {
                                debug!("Transcription operation cancelled before paste");
                                utils::hide_recording_overlay(&ah);
                                change_tray_icon(&ah, TrayIconState::Idle);
                                return;
                            }

                            // CloseLabs Voice: sin guardado de historial.
                            let _ = &transcription;

                            if processed.final_text.is_empty() {
                                utils::hide_recording_overlay(&ah);
                                change_tray_icon(&ah, TrayIconState::Idle);
                            } else {
                                crate::last_transcript::set(&processed.final_text);
                                let ah_clone = ah.clone();
                                let paste_time = Instant::now();
                                let final_text = processed.final_text;
                                let rm_for_paste = Arc::clone(&rm);
                                ah.run_on_main_thread(move || {
                                    if rm_for_paste.was_cancelled_since(cancel_generation) {
                                        debug!("Transcription operation cancelled before paste");
                                        utils::hide_recording_overlay(&ah_clone);
                                        change_tray_icon(&ah_clone, TrayIconState::Idle);
                                        return;
                                    }

                                    match utils::paste(final_text, ah_clone.clone()) {
                                        Ok(()) => debug!(
                                            "Text pasted successfully in {:?}",
                                            paste_time.elapsed()
                                        ),
                                        Err(e) => {
                                            error!("Failed to paste transcription: {}", e);
                                            let _ = ah_clone.emit("paste-error", ());
                                        }
                                    }
                                    utils::hide_recording_overlay(&ah_clone);
                                    change_tray_icon(&ah_clone, TrayIconState::Idle);
                                })
                                .unwrap_or_else(|e| {
                                    error!("Failed to run paste on main thread: {:?}", e);
                                    utils::hide_recording_overlay(&ah);
                                    change_tray_icon(&ah, TrayIconState::Idle);
                                });
                            }
                        }
                        Err(err) => {
                            if rm.was_cancelled_since(cancel_generation) {
                                debug!(
                                    "Transcription operation cancelled after transcription error"
                                );
                                utils::hide_recording_overlay(&ah);
                                change_tray_icon(&ah, TrayIconState::Idle);
                                return;
                            }

                            error!("Transcription failed: {}", err);
                            // Surface the failure to the UI (toast). The full
                            // message is also in handy.log via the line above.
                            let _ = ah.emit("transcription-error", err.to_string());
                            // CloseLabs Voice: sin guardado de historial de fallos.
                            utils::hide_recording_overlay(&ah);
                            change_tray_icon(&ah, TrayIconState::Idle);
                        }
                    }
                }
            } else {
                debug!("No samples retrieved from recording stop");
                // Tear down any streaming worker so its channel doesn't leak.
                tm.cancel_stream();
                utils::hide_recording_overlay(&ah);
                change_tray_icon(&ah, TrayIconState::Idle);
            }
        });

        debug!(
            "TranscribeAction::stop completed in {:?}",
            stop_time.elapsed()
        );
    }
}

/// Vuelve a transcribir el último dictado sin volver a grabarlo.
///
/// Para qué sirve en consulta: si el internet se cayó justo al dictar, la app resuelve con el
/// Parakeet local (más flojo en texto largo); y si el médico acaba de agregar un fármaco al
/// diccionario, la transcripción anterior no lo tenía. En ambos casos esto lo arregla sin
/// pedirle al paciente que espere otro dictado.
///
/// No reutiliza el flujo de [`TranscribeAction`] porque aquí no hay grabación en curso: no hay
/// nada que cancelar, ni overlay de grabación, ni stream en vivo. Lo que sí comparte son las
/// piezas que importan — la transcripción en la nube, la limpieza y el pegado — así que el
/// resultado es idéntico al de un dictado normal.
struct ReprocessLastAction;

/// Evita que dos reprocesos se pisen si el médico machaca el atajo: el segundo pegaría el texto
/// encima del primero, en cualquier campo donde haya quedado el cursor.
static REPROCESS_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

/// Libera [`REPROCESS_IN_FLIGHT`] pase lo que pase — incluido un `return` temprano o un panic —
/// para que un fallo no deje el atajo muerto por el resto de la sesión.
struct ReprocessGuard;

impl Drop for ReprocessGuard {
    fn drop(&mut self) {
        REPROCESS_IN_FLIGHT.store(false, Ordering::SeqCst);
    }
}

impl ShortcutAction for ReprocessLastAction {
    fn start(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        // Con una grabación en curso no se reprocesa: si no, al soltar la tecla se pegarían dos
        // textos distintos en el mismo campo.
        if app
            .try_state::<Arc<AudioRecordingManager>>()
            .is_some_and(|rm| rm.is_recording())
        {
            debug!("Reprocesar: hay una grabación en curso; se ignora");
            return;
        }
        if REPROCESS_IN_FLIGHT.swap(true, Ordering::SeqCst) {
            debug!("Reprocesar: ya hay uno en curso; se ignora");
            return;
        }
        let guard = ReprocessGuard;

        let Some(samples) = crate::last_recording::get() else {
            debug!("Reprocesar: no hay audio del último dictado en memoria");
            let _ = app.emit("reprocess-unavailable", ());
            return;
        };

        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let _guard = guard; // se libera al terminar la tarea, salga como salga
            debug!(
                "Reprocesando el último dictado ({} muestras)",
                samples.len()
            );
            show_processing_overlay(&app);

            let started = Instant::now();
            let transcription = match try_cloud_transcription(&app, &samples).await {
                Some(text) => Some(text),
                None => {
                    let tm = app.state::<Arc<TranscriptionManager>>();
                    match tm.transcribe(samples) {
                        Ok(text) if !is_whisper_hallucination(&text, None) => Some(text),
                        Ok(_) => {
                            warn!("Reprocesar: transcripción local descartada (alucinación)");
                            None
                        }
                        Err(err) => {
                            error!("Reprocesar: falló la transcripción: {err}");
                            let _ = app.emit("transcription-error", err.to_string());
                            None
                        }
                    }
                }
            };

            let final_text = match transcription {
                Some(text) if !text.trim().is_empty() => {
                    let settings = get_settings(&app);
                    process_transcription_output(&app, &text, settings.post_process_enabled)
                        .await
                        .final_text
                }
                _ => String::new(),
            };

            if final_text.is_empty() {
                debug!("Reprocesar: no se obtuvo texto; no se pega nada");
                utils::hide_recording_overlay(&app);
                change_tray_icon(&app, TrayIconState::Idle);
                return;
            }

            debug!(
                "Reprocesado en {:?}: {} chars",
                started.elapsed(),
                final_text.chars().count()
            );
            crate::last_transcript::set(&final_text);

            let app_for_paste = app.clone();
            let _ = app.run_on_main_thread(move || {
                let handle = app_for_paste.clone();
                if let Err(e) = utils::paste(final_text, handle) {
                    error!("Reprocesar: falló el pegado: {e}");
                    let _ = app_for_paste.emit("paste-error", ());
                }
                utils::hide_recording_overlay(&app_for_paste);
                change_tray_icon(&app_for_paste, TrayIconState::Idle);
            });
        });
    }

    fn stop(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        // Se dispara al presionar; soltar la tecla no hace nada.
    }
}

// Cancel Action
struct CancelAction;

impl ShortcutAction for CancelAction {
    fn start(&self, app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        utils::cancel_current_operation(app);
    }

    fn stop(&self, _app: &AppHandle, _binding_id: &str, _shortcut_str: &str) {
        // Nothing to do on stop for cancel
    }
}

// Test Action
struct TestAction;

impl ShortcutAction for TestAction {
    fn start(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        log::info!(
            "Shortcut ID '{}': Started - {} (App: {})", // Changed "Pressed" to "Started" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }

    fn stop(&self, app: &AppHandle, binding_id: &str, shortcut_str: &str) {
        log::info!(
            "Shortcut ID '{}': Stopped - {} (App: {})", // Changed "Released" to "Stopped" for consistency
            binding_id,
            shortcut_str,
            app.package_info().name
        );
    }
}

// Static Action Map
pub static ACTION_MAP: Lazy<HashMap<String, Arc<dyn ShortcutAction>>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(
        "transcribe".to_string(),
        Arc::new(TranscribeAction {
            post_process: false,
        }) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "transcribe_with_post_process".to_string(),
        Arc::new(TranscribeAction { post_process: true }) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "reprocess_last".to_string(),
        Arc::new(ReprocessLastAction) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "cancel".to_string(),
        Arc::new(CancelAction) as Arc<dyn ShortcutAction>,
    );
    map.insert(
        "test".to_string(),
        Arc::new(TestAction) as Arc<dyn ShortcutAction>,
    );
    map
});

#[cfg(test)]
mod tests {
    use super::{is_blank_transcription, is_offline_error, is_timeout_error};

    #[test]
    fn timeouts_are_detected_so_we_do_not_wait_twice() {
        // Texto real de reqwest al agotarse el tiempo.
        assert!(is_timeout_error(
            "HTTP request failed: error sending request: operation timed out"
        ));
        assert!(is_timeout_error(
            "request or response body error: timed out"
        ));
    }

    #[test]
    fn a_normal_api_error_still_gets_its_retry() {
        // Un 500 o un rechazo del proveedor sí merece el reintento: no debe confundirse
        // con un timeout ni con estar sin internet.
        let err = "API request failed with status 500: internal server error";
        assert!(!is_timeout_error(err));
        assert!(!is_offline_error(err));
    }

    #[test]
    fn blank_transcription_is_detected() {
        assert!(is_blank_transcription(""));
        assert!(is_blank_transcription("   "));
        assert!(is_blank_transcription("\t\n  \r\n"));
    }

    #[test]
    fn non_blank_transcription_is_kept() {
        assert!(!is_blank_transcription("hello"));
        assert!(!is_blank_transcription("  hello  "));
    }
}
