//! Cliente HTTP hacia un proveedor de LLM compatible con OpenAI.
//!
//! ⚠️ De este módulo ya NO sale ningún dictado. El formateo vive en nuestro proxy
//! (`proxy::format` → Edge Function `/format`), que es quien guarda la llave y decide a qué
//! proveedor llamar. Lo único que queda aquí es **listar los modelos disponibles**, para el
//! selector de Ajustes cuando alguien configura su propio proveedor a mano.
//!
//! El cliente de chat que vivía aquí se borró a propósito, y no solo por estar sin usar: era una
//! segunda ruta directa al proveedor, con su propia llave. Dejarla ahí invitaba a reconectarla y
//! reintroducir justo lo que la Fase 1 vino a quitar.

use crate::settings::PostProcessProvider;
use log::debug;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, REFERER, USER_AGENT};
use std::time::Duration;

/// Tiempo máximo para abrir la conexión. Sin internet, rendirse rápido en vez de colgar la UI.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);

/// Tope de la petición completa. Listar modelos es una llamada chica; si tarda más que esto, el
/// proveedor tiene un problema y la lista puede esperar.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// Build headers for API requests based on provider type
fn build_headers(provider: &PostProcessProvider, api_key: &str) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();

    // Common headers
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(REFERER, HeaderValue::from_static("https://www.closelabs.co"));
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("CloseLabsVoice/1.0 (+https://www.closelabs.co)"),
    );
    headers.insert("X-Title", HeaderValue::from_static("CloseLabs Voice"));

    // Provider-specific auth headers
    if !api_key.is_empty() {
        if provider.id == "anthropic" {
            headers.insert(
                "x-api-key",
                HeaderValue::from_str(api_key)
                    .map_err(|e| format!("Invalid API key header value: {}", e))?,
            );
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));
        } else {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {}", api_key))
                    .map_err(|e| format!("Invalid authorization header value: {}", e))?,
            );
        }
    }

    Ok(headers)
}

/// Create an HTTP client with provider-specific headers
fn create_client(provider: &PostProcessProvider, api_key: &str) -> Result<reqwest::Client, String> {
    let headers = build_headers(provider, api_key)?;
    reqwest::Client::builder()
        .default_headers(headers)
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

/// Fetch available models from an OpenAI-compatible API
/// Returns a list of model IDs
pub async fn fetch_models(
    provider: &PostProcessProvider,
    api_key: String,
) -> Result<Vec<String>, String> {
    let base_url = provider.base_url.trim_end_matches('/');
    let url = format!("{}/models", base_url);

    debug!("Fetching models from: {}", url);

    let client = create_client(provider, &api_key)?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!(
            "Model list request failed ({}): {}",
            status, error_text
        ));
    }

    let parsed: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let mut models = Vec::new();

    // Handle OpenAI format: { data: [ { id: "..." }, ... ] }
    if let Some(data) = parsed.get("data").and_then(|d| d.as_array()) {
        for entry in data {
            if let Some(id) = entry.get("id").and_then(|i| i.as_str()) {
                models.push(id.to_string());
            } else if let Some(name) = entry.get("name").and_then(|n| n.as_str()) {
                models.push(name.to_string());
            }
        }
    }
    // Handle array format: [ "model1", "model2", ... ]
    else if let Some(array) = parsed.as_array() {
        for entry in array {
            if let Some(model) = entry.as_str() {
                models.push(model.to_string());
            }
        }
    }

    Ok(models)
}
