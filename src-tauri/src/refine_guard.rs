//! CloseLabs Voice — guardas del refine (limpieza con LLM).
//!
//! En una nota clínica es inaceptable que el refine invente, omita o filtre texto del prompt.
//! Si la salida del LLM no parece una versión limpia de lo que se dictó, se descarta y se pega
//! la transcripción cruda. Técnica inspirada en Aztec 1.8.2 (eco, fuga de prompt/ejemplos,
//! proporción de longitud), más nuestra guarda anti-rechazo.

/// Dictados con menos palabras que esto no pasan por el LLM: no hay nada que ordenar y se
/// ahorra latencia y el riesgo de que "reescriba" una respuesta corta.
pub const MIN_WORDS_FOR_REFINE: usize = 3;

/// Mínima fracción de palabras de la salida que deben existir en la entrada.
const MIN_OUTPUT_OVERLAP: f64 = 0.6;
/// Palabras seguidas del prompt que, si aparecen en la salida y no en la entrada, delatan fuga.
const LEAK_SHINGLE_WORDS: usize = 6;

/// Frases con las que el modelo comenta o se niega en vez de limpiar el texto.
const REFUSAL_MARKERS: [&str; 9] = [
    "no parece ser una",
    "no parece una conversación",
    "no es una transcrip",
    "no es una conversación",
    "proporciona una transcrip",
    "proporciona un dictado",
    "según las instrucciones",
    "lo siento, pero",
    "no puedo ayudarte",
];

/// `true` si vale la pena llamar al LLM para este texto.
pub fn should_refine(transcription: &str) -> bool {
    transcription.split_whitespace().count() >= MIN_WORDS_FOR_REFINE
}

/// Palabras normalizadas (minúsculas, sin tildes ni puntuación).
fn words(text: &str) -> Vec<String> {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' => 'a',
            'é' | 'è' | 'ë' => 'e',
            'í' | 'ì' | 'ï' => 'i',
            'ó' | 'ò' | 'ö' => 'o',
            'ú' | 'ù' | 'ü' => 'u',
            c if c.is_alphanumeric() => c,
            _ => ' ',
        })
        .collect::<String>()
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

/// Devuelve `Some(motivo)` si la salida del refine debe descartarse (se usa la cruda).
pub fn rejection_reason(input: &str, output: &str, prompt: &str) -> Option<&'static str> {
    let output = output.trim();
    if output.is_empty() {
        return Some("salida vacía");
    }

    let low = output.to_lowercase();
    if REFUSAL_MARKERS.iter().any(|m| low.contains(m)) {
        return Some("meta-respuesta o rechazo");
    }

    // Limpiar no hace crecer mucho el texto, ni lo reduce a una fracción.
    let input_len = input.trim().chars().count();
    let output_len = output.chars().count();
    if output_len > input_len * 2 + 30 {
        return Some("salida desproporcionadamente larga");
    }
    if input_len >= 40 && output_len * 10 < input_len * 4 {
        return Some("salida desproporcionadamente corta");
    }

    let input_words = words(input);
    let output_words = words(output);
    if output_words.is_empty() {
        return Some("salida sin palabras");
    }

    // Eco/invención: la mayoría de palabras de la salida deben venir del dictado. Solo cuentan
    // palabras con letras y 3+ caracteres: el refine convierte legítimamente "ochocientos
    // cincuenta miligramos" en "850 mg", y eso no debe parecer invención.
    let input_set: std::collections::HashSet<&str> =
        input_words.iter().map(String::as_str).collect();
    let content: Vec<&String> = output_words
        .iter()
        .filter(|w| w.chars().count() >= 3 && w.chars().all(char::is_alphabetic))
        .collect();
    let shared = content
        .iter()
        .filter(|w| input_set.contains(w.as_str()))
        .count();
    if input_words.len() >= 5
        && !content.is_empty()
        && (shared as f64) < content.len() as f64 * MIN_OUTPUT_OVERLAP
    {
        return Some("comparte muy poco contenido con el dictado");
    }

    // Fuga del prompt o de sus ejemplos: una secuencia del prompt que no se dictó.
    let prompt_words = words(prompt);
    if prompt_words.len() >= LEAK_SHINGLE_WORDS {
        let input_joined = format!(" {} ", input_words.join(" "));
        let output_joined = format!(" {} ", output_words.join(" "));
        let leaked = prompt_words.windows(LEAK_SHINGLE_WORDS).any(|w| {
            let shingle = format!(" {} ", w.join(" "));
            output_joined.contains(&shingle) && !input_joined.contains(&shingle)
        });
        if leaked {
            return Some("contiene texto del prompt que no se dictó");
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROMPT: &str = "Eres un formateador de dictados. Ejemplo: paciente de 45 años con \
        dolor torácico de dos días de evolución.";

    #[test]
    fn accepts_normal_cleanup() {
        let input =
            "eh paciente masculino de 60 años eh con diabetes tipo 2 en manejo con metformina";
        let output = "Paciente masculino de 60 años con diabetes tipo 2 en manejo con metformina.";
        assert_eq!(rejection_reason(input, output, PROMPT), None);
    }

    #[test]
    fn rejects_empty_and_refusals() {
        assert!(rejection_reason("hola doctor cómo está", "  ", PROMPT).is_some());
        assert!(rejection_reason(
            "hola doctor cómo está",
            "Lo siento, pero no puedo ayudarte con eso.",
            PROMPT
        )
        .is_some());
    }

    #[test]
    fn rejects_invented_content() {
        let input = "control en tres meses con exámenes";
        let output =
            "El paciente acudió acompañado de su esposa y refiere mejoría general notable.";
        assert!(rejection_reason(input, output, PROMPT).is_some());
    }

    #[test]
    fn accepts_numbers_written_as_digits() {
        let input = "metformina ochocientos cincuenta miligramos cada doce horas por treinta días";
        let output = "Metformina 850 mg cada 12 horas por 30 días.";
        assert_eq!(rejection_reason(input, output, PROMPT), None);
    }

    #[test]
    fn rejects_truncated_output() {
        let input =
            "paciente refiere cefalea de tres días asociada a náuseas y fotofobia sin fiebre";
        assert!(rejection_reason(input, "Cefalea.", PROMPT).is_some());
    }

    #[test]
    fn rejects_prompt_example_leak() {
        let input = "paciente de 45 años con fiebre y tos seca desde ayer";
        let output = "Paciente de 45 años con dolor torácico de dos días de evolución, fiebre y tos seca desde ayer.";
        assert_eq!(
            rejection_reason(input, output, PROMPT),
            Some("contiene texto del prompt que no se dictó")
        );
    }

    #[test]
    fn short_dictations_skip_refine() {
        assert!(!should_refine("Sí, claro"));
        assert!(should_refine("Control en tres meses"));
    }
}
