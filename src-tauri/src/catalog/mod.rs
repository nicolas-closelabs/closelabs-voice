//! The bundled, offline model catalog.
//!
//! `catalog.json` is generated at build time by `scripts/gen_catalog.py` from the
//! `handy-computer` Hugging Face org (card `transcribe_cpp` capabilities +
//! benchmarks, a GGUF header probe for name/params, and local curation for the
//! recommended set). It is compiled into the binary so Handy ships a complete
//! model list with zero network access.
//!
//! Each entry is normalised into a [`ModelDescriptor`] — the same source-agnostic
//! shape every other producer (HF discovery, on-disk scans, the legacy table)
//! yields — so the catalog is "just another producer". Its explicit `capabilities`
//! map becomes a [`CapabilityProbe`] with confident `Some(..)` values; the runtime
//! `GgufHeaderProber` is the same shape with `None` where a header omits a key,
//! which is why the two are interchangeable (the catalog is a baked probe).

use std::collections::HashMap;

use once_cell::sync::Lazy;
use serde::Deserialize;

use crate::managers::model::{
    default_quant_file, EngineType, ModelDescriptor, ModelSource, QuantFile,
};
use crate::managers::model_capabilities::{CapabilityProbe, Compatibility};

#[derive(Deserialize)]
struct CatalogRoot {
    models: Vec<CatalogModel>,
}

/// One model as written in `catalog.json`. Only the fields the descriptor needs
/// are declared; serde ignores the rest (slug, family, license, …).
#[derive(Deserialize)]
struct CatalogModel {
    /// HF repo id, e.g. `handy-computer/whisper-small-gguf`.
    id: String,
    name: String,
    description: String,
    architecture: Option<String>,
    languages: Vec<String>,
    capabilities: CatalogCaps,
    speed_score: Option<f32>,
    accuracy_score: Option<f32>,
    files: Vec<QuantFile>,
    default_quant: Option<String>,
    recommended_rank: Option<u32>,
    /// Part of the small curated onboarding set (badged "Recommended"). Distinct
    /// from `recommended_rank`, which only orders the full list.
    #[serde(default)]
    recommended: bool,
}

#[derive(Deserialize)]
struct CatalogCaps {
    streaming: bool,
    translate: bool,
    lang_detect: bool,
    // `timestamps` (a string enum) is present in the catalog but has no
    // `CapabilityProbe` field yet — wire it through when the probe gains one.
}

impl From<CatalogModel> for ModelDescriptor {
    fn from(m: CatalogModel) -> Self {
        // The default download file. Its name is folded into the id so a catalog
        // entry collides (dedups) with the very same file later discovered in
        // the HF cache — both compute `"{repo_id}/{filename}"`.
        let default_filename = default_quant_file(&m.files, m.default_quant.as_deref())
            .map(|f| f.filename.clone())
            .unwrap_or_default();

        ModelDescriptor {
            id: format!("{}/{}", m.id, default_filename),
            source: ModelSource::HuggingFace {
                repo_id: m.id,
                revision: "main".to_string(),
            },
            name: m.name,
            description: m.description,
            engine_type: EngineType::TranscribeCpp,
            caps: CapabilityProbe {
                verdict: Compatibility::Compatible, // curated org models we ship support for
                display_name: None,
                architecture: m.architecture,
                variant: None,
                languages: Some(m.languages),
                supports_streaming: Some(m.capabilities.streaming),
                supports_translation: Some(m.capabilities.translate),
                supports_language_detect: Some(m.capabilities.lang_detect),
            },
            files: m.files,
            default_quant: m.default_quant,
            // catalog scores are 0–100; ModelInfo / the UI bars use 0.0–1.0.
            speed_score: m.speed_score.unwrap_or(0.0) / 100.0,
            accuracy_score: m.accuracy_score.unwrap_or(0.0) / 100.0,
            recommended_rank: m.recommended_rank,
            recommended: m.recommended,
        }
    }
}

/// The bundled catalog, parsed once and normalised into descriptors.
pub static CATALOG: Lazy<Vec<ModelDescriptor>> = Lazy::new(|| {
    let root: CatalogRoot = serde_json::from_str(include_str!("catalog.json"))
        .expect("bundled catalog.json is valid JSON matching the catalog schema");
    root.models.into_iter().map(ModelDescriptor::from).collect()
});

/// Editorial recommended rank keyed by descriptor id (the same id the model
/// registry uses). Built once from the catalog.
static RANK_BY_ID: Lazy<HashMap<String, u32>> = Lazy::new(|| {
    CATALOG
        .iter()
        .filter_map(|d| d.recommended_rank.map(|r| (d.id.clone(), r)))
        .collect()
});

/// `true` si `model_id` es uno de los modelos que este producto ofrece.
///
/// Acepta dos formas, porque el registro usa las dos: el id del catálogo a secas
/// (`handy-computer/parakeet-tdt-0.6b-v3-gguf`) y el id por archivo que se arma al descargar o
/// al encontrarlo en la caché de HuggingFace (`…-gguf/parakeet-tdt-0.6b-v3-Q5_K_M.gguf`).
///
/// Existe por un problema real de testers: la app hereda de Handy un registro con toda su
/// colección de modelos (Whisper small, medium, large…) y además escanea la caché de
/// HuggingFace. Quien instaló una versión vieja sigue teniendo el Whisper Medium en disco, así
/// que la app se lo ofrecía y podía elegirlo — y ese modelo es el que hacía que un Mac Intel
/// tardara 48 segundos en transcribir 2,5 de audio. CloseLabs Voice tiene UN motor local.
pub fn is_catalog_model(model_id: &str) -> bool {
    CATALOG.iter().any(|d| {
        model_id == d.id
            || d.files
                .iter()
                .any(|f| model_id == format!("{}/{}", d.id, f.filename))
    })
}

/// El modelo local que debe usar el producto: el primero del catálogo, con su cuantización por
/// defecto. Es a lo que se vuelve cuando los ajustes apuntan a un modelo que ya no ofrecemos.
pub fn default_model_id() -> Option<String> {
    let d = CATALOG.first()?;
    let quant = d.default_quant.as_deref();
    let file = d
        .files
        .iter()
        .find(|f| Some(f.quant.as_str()) == quant)
        .or_else(|| d.files.first())?;
    Some(format!("{}/{}", d.id, file.filename))
}

/// Recommended rank for a model id (lower = higher priority). Returns
/// `u32::MAX` for unranked/unknown ids so they sort last in an ascending sort.
pub fn rank_of(model_id: &str) -> u32 {
    RANK_BY_ID.get(model_id).copied().unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::managers::model_capabilities::KNOWN_ARCHES;
    use std::collections::BTreeSet;

    #[test]
    fn el_catalogo_reconoce_sus_propios_modelos() {
        // Las dos formas del id que usa el registro: el del catálogo a secas y el que se arma
        // por archivo al descargar o al hallarlo en la caché de HuggingFace.
        let d = CATALOG.first().expect("el catálogo no puede estar vacío");
        assert!(is_catalog_model(&d.id));
        let f = d.files.first().expect("todo modelo tiene al menos un archivo");
        assert!(is_catalog_model(&format!("{}/{}", d.id, f.filename)));
    }

    #[test]
    fn los_modelos_viejos_de_handy_no_pasan() {
        // El caso real que motivó el filtro: un tester con instalación antigua tenía Whisper
        // Medium en la caché y la app se lo ofrecía. Ese modelo es el que hacía a un Mac Intel
        // tardar 48 segundos en transcribir 2,5 de audio.
        assert!(!is_catalog_model("medium"));
        assert!(!is_catalog_model("small"));
        assert!(!is_catalog_model("ggerganov/whisper.cpp/ggml-medium.bin"));
        assert!(!is_catalog_model(""));
    }

    #[test]
    fn un_archivo_que_no_es_del_modelo_no_cuela() {
        // Que el id EMPIECE por el del catálogo no basta: tiene que ser un archivo declarado.
        // Si no, cualquier cosa dentro del mismo repo de HuggingFace pasaría el filtro.
        let d = CATALOG.first().unwrap();
        assert!(!is_catalog_model(&format!("{}/modelo-inventado.gguf", d.id)));
    }

    #[test]
    fn el_modelo_por_defecto_es_del_catalogo() {
        let id = default_model_id().expect("debe haber un modelo por defecto");
        assert!(is_catalog_model(&id));
        // Y es la cuantización que declara el catálogo, no una cualquiera.
        assert!(id.contains("Q5_K_M"), "id inesperado: {id}");
    }

    #[test]
    fn catalog_parses_and_is_nonempty() {
        assert!(!CATALOG.is_empty(), "bundled catalog should contain models");
    }

    #[test]
    fn ids_are_unique() {
        let mut ids: Vec<&str> = CATALOG.iter().map(|d| d.id.as_str()).collect();
        ids.sort_unstable();
        let before = ids.len();
        ids.dedup();
        assert_eq!(before, ids.len(), "catalog descriptor ids must be unique");
    }

    #[test]
    fn scores_are_normalised_0_to_1() {
        for d in CATALOG.iter() {
            assert!((0.0..=1.0).contains(&d.speed_score), "{} speed", d.id);
            assert!((0.0..=1.0).contains(&d.accuracy_score), "{} acc", d.id);
        }
    }

    #[test]
    fn catalog_architectures_are_known_to_capability_probe() {
        let missing: BTreeSet<&str> = CATALOG
            .iter()
            .filter_map(|d| d.caps.architecture.as_deref())
            .filter(|arch| !KNOWN_ARCHES.contains(arch))
            .collect();

        assert!(
            missing.is_empty(),
            "catalog architecture(s) missing from KNOWN_ARCHES: {:?}",
            missing
        );
    }
}
