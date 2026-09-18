//! CloseLabs Voice — emails y URLs dictados en voz alta.
//!
//! El médico dicta "maria punto lopez arroba clinica punto com" y Whisper lo escribe tal cual.
//! Aquí se reconstruye `maria.lopez@clinica.com` de forma **determinista y local**, así que
//! también funciona sin internet (cuando no hay limpieza con IA).
//!
//! Conservador a propósito: solo actúa si hay una señal fuerte ("arroba", "www", o un dominio
//! con extensión conocida). "Hasta cierto punto" o "el punto de dolor" no se tocan.

use once_cell::sync::Lazy;
use regex::Regex;

/// Extensiones de dominio que damos por válidas al dictar. Se transcriben LITERALES: si dijo
/// "punto co" queda `.co`, nunca `.com`.
const TLDS: &[&str] = &[
    "com", "co", "net", "org", "io", "app", "dev", "es", "mx", "pe", "cl", "ar", "br", "gov",
    "edu", "info", "me", "ai", "health", "clinic",
];

/// Palabras que el hablante usa como separadores dentro de un email o una URL.
fn symbol_for(word: &str) -> Option<&'static str> {
    match word {
        "arroba" | "at" => Some("@"),
        "punto" | "dot" => Some("."),
        "guion" | "guión" | "guionmedio" | "dash" | "hyphen" => Some("-"),
        "guionbajo" | "underscore" => Some("_"),
        "slash" | "barra" | "diagonal" => Some("/"),
        _ => None,
    }
}

/// Minúsculas y sin tildes: el cuerpo de un email o URL siempre va en ASCII.
fn fold(word: &str) -> String {
    word.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' => 'u',
            'ñ' => 'n',
            'ü' => 'u',
            c => c,
        })
        .collect()
}

/// Token "limpio" (sin puntuación de los extremos) y su puntuación final, que se conserva:
/// "com." → ("com", ".").
fn split_trailing_punct(token: &str) -> (&str, &str) {
    let end = token
        .rfind(|c: char| c.is_alphanumeric())
        .map(|i| i + token[i..].chars().next().map_or(1, char::len_utf8))
        .unwrap_or(0);
    (&token[..end], &token[end..])
}

static ALREADY_FORMATTED: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+|https?://|www\.").unwrap());

/// Une los tokens de un email/URL dictado en una sola cadena.
fn join_spoken(tokens: &[&str]) -> String {
    let mut out = String::new();
    for token in tokens {
        match symbol_for(&fold(token)) {
            Some(symbol) => out.push_str(symbol),
            None => out.push_str(&fold(token)),
        }
    }
    out
}

/// Reconstruye emails y URLs dictados. Devuelve el texto con los reemplazos aplicados.
pub fn normalize_spoken_emails_and_urls(text: &str) -> String {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let mut out: Vec<String> = Vec::with_capacity(tokens.len());
    let mut i = 0;

    while i < tokens.len() {
        match scan_address(&tokens, i) {
            Some(last) => {
                let words: Vec<&str> = tokens[i..=last]
                    .iter()
                    .map(|t| split_trailing_punct(t).0)
                    .collect();
                let trailing = split_trailing_punct(tokens[last]).1;
                out.push(format!("{}{}", join_spoken(&words), trailing));
                i = last + 1;
            }
            None => {
                out.push(tokens[i].to_string());
                i += 1;
            }
        }
    }

    out.join(" ")
}

/// ¿El token es una palabra simple (solo letras/dígitos, sin ser un separador hablado)?
fn is_plain_word(token: &str) -> bool {
    let (word, _) = split_trailing_punct(token);
    let folded = fold(word);
    !folded.is_empty()
        && folded.chars().all(char::is_alphanumeric)
        && symbol_for(&folded).is_none()
}

/// Busca en `tokens`, desde `start`, el patrón `palabra (separador palabra)+`. Devuelve el
/// índice del último token de la dirección, o `None` si ahí no empieza un email/URL.
fn scan_address(tokens: &[&str], start: usize) -> Option<usize> {
    if !is_plain_word(tokens[start]) || ALREADY_FORMATTED.is_match(tokens[start]) {
        return None;
    }

    let mut last_word = start;
    let mut has_at = false;
    let mut has_tld = false;
    let mut pos = start;

    loop {
        // Una palabra con puntuación pegada ("com.") cierra la dirección.
        if !split_trailing_punct(tokens[pos]).1.is_empty() {
            break;
        }
        let (symbol_idx, word_idx) = (pos + 1, pos + 2);
        if word_idx >= tokens.len() {
            break;
        }
        let Some(symbol) = symbol_for(&fold(split_trailing_punct(tokens[symbol_idx]).0)) else {
            break;
        };
        if !split_trailing_punct(tokens[symbol_idx]).1.is_empty() || !is_plain_word(tokens[word_idx])
        {
            break;
        }

        let next_word = fold(split_trailing_punct(tokens[word_idx]).0);
        if symbol == "@" {
            has_at = true;
        }
        // Una extensión conocida solo cuenta detrás de un punto: "punto co" → ".co".
        if symbol == "." && TLDS.contains(&next_word.as_str()) {
            has_tld = true;
        }

        last_word = word_idx;
        pos = word_idx;
    }

    // Sin "arroba" ni dominio conocido no hay forma de saber que era una dirección.
    if last_word > start && (has_at || has_tld) {
        Some(last_word)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebuilds_dictated_email() {
        assert_eq!(
            normalize_spoken_emails_and_urls("mándale el resumen a maria punto lopez arroba clinica punto com por favor"),
            "mándale el resumen a maria.lopez@clinica.com por favor"
        );
    }

    #[test]
    fn folds_accents_inside_the_address_only() {
        assert_eq!(
            normalize_spoken_emails_and_urls("escríbele a josé arroba clínica punto co"),
            "escríbele a jose@clinica.co"
        );
    }

    #[test]
    fn keeps_spoken_tld_literally() {
        assert_eq!(
            normalize_spoken_emails_and_urls("agenda en closelabs punto co"),
            "agenda en closelabs.co"
        );
    }

    #[test]
    fn rebuilds_url_with_path() {
        assert_eq!(
            normalize_spoken_emails_and_urls("entra a closelabs punto co slash agenda"),
            "entra a closelabs.co/agenda"
        );
    }

    #[test]
    fn leaves_normal_speech_untouched() {
        for text in [
            "hasta cierto punto el paciente mejoró",
            "el punto de mayor dolor es el epigastrio",
            "control en tres meses",
            "punto y aparte",
        ] {
            assert_eq!(normalize_spoken_emails_and_urls(text), text);
        }
    }

    #[test]
    fn preserves_sentence_punctuation() {
        assert_eq!(
            normalize_spoken_emails_and_urls("mi correo es juan arroba gmail punto com. Gracias"),
            "mi correo es juan@gmail.com. Gracias"
        );
    }

    #[test]
    fn leaves_already_formatted_addresses_alone() {
        let text = "escribe a juan@gmail.com y revisa https://closelabs.co";
        assert_eq!(normalize_spoken_emails_and_urls(text), text);
    }

    #[test]
    fn handles_hyphens_in_addresses() {
        assert_eq!(
            normalize_spoken_emails_and_urls("es maria guion jose arroba clinica punto com"),
            "es maria-jose@clinica.com"
        );
    }
}
