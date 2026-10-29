//! CloseLabs Voice — qué campo tiene el cursor de escritura, para COMPROBAR que el dictado entró.
//!
//! ⚠️ Por qué existe (2026-10-28): un médico de gMedic dictaba, la app mandaba Cmd+V, el log decía
//! "Dictado pegado"… y el campo seguía vacío. El log solo sabía que se habían mandado las teclas,
//! no si el texto llegó, así que no había forma de saber qué pasó ni de avisarle al médico.
//!
//! Ahora se lee el campo seleccionado antes y después de pegar (Accesibilidad en macOS, UI
//! Automation en Windows) y se compara. Es una comprobación EXACTA, no una adivinanza: o el texto
//! dictado aparece en el campo, o no aparece. Por eso se le puede aplicar al médico (ver la regla
//! de "solo comprobaciones exactas" en CLAUDE.md).
//!
//! Privacidad: el contenido del campo puede ser una historia clínica. Se lee solo para comparar
//! en memoria y NUNCA se escribe en el log; `describir()` devuelve solo la app y el tipo de campo.
//!
//! Todo falla hacia "no se sabe" (`Campo::Desconocido`): sin permiso, sin respuesta a tiempo o en
//! una app que no expone su contenido, se pega como siempre y no se le avisa nada al médico.

use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub enum Campo {
    /// Un campo de texto cuyo contenido se pudo leer.
    Texto {
        app: String,
        rol: String,
        valor: String,
    },
    /// Hay algo seleccionado, pero no es un campo cuyo texto se pueda leer.
    Otro { app: String, rol: String },
    /// No se pudo preguntar: sin permiso, sin respuesta a tiempo o plataforma sin soporte.
    /// `motivo` dice en qué paso falló y con qué código, para el log (sin contenido).
    Desconocido { motivo: String },
}

fn desconocido(motivo: impl Into<String>) -> Campo {
    Campo::Desconocido {
        motivo: motivo.into(),
    }
}

impl Campo {
    /// Para el log: la app y el tipo de campo. NUNCA el contenido.
    pub fn describir(&self) -> String {
        match self {
            Campo::Texto { app, rol, valor } => {
                format!("app={app} campo={rol} ({} caracteres)", valor.chars().count())
            }
            Campo::Otro { app, rol } => format!("app={app} campo={rol} (no es de texto)"),
            Campo::Desconocido { motivo } => format!("campo desconocido: {motivo}"),
        }
    }
}

/// Más allá de esto no se compara: un documento enorme no es el campo de una historia clínica, y
/// releerlo varias veces por segundo no vale la pena.
const MAX_VALOR: usize = 200_000;

/// Lo máximo que se espera a que la otra app conteste justo antes de pegar (hilo principal, el
/// médico está esperando). Una app colgada no puede colgar el pegado.
pub const TOPE_ANTES_DE_PEGAR: Duration = Duration::from_millis(400);

/// En segundo plano (foto previa, comprobación después de pegar) se puede esperar más: Chrome,
/// recién encendida su accesibilidad, tarda en contestar en páginas pesadas.
pub const TOPE_EN_SEGUNDO_PLANO: Duration = Duration::from_millis(1500);

/// Lee el campo seleccionado en la app que está al frente, esperando como mucho `tope`.
pub fn leer(tope: Duration) -> Campo {
    let (tx, rx) = mpsc::channel();
    // En un hilo propio: así el tope de tiempo vale aunque la otra app no conteste, y en Windows
    // UI Automation corre en un hilo MTA nuevo, no en el hilo de la interfaz.
    std::thread::spawn(move || {
        let _ = tx.send(plataforma::leer());
    });
    match rx.recv_timeout(tope) {
        Ok(Campo::Texto { valor, .. }) if valor.chars().count() > MAX_VALOR => {
            desconocido("campo demasiado grande")
        }
        Ok(campo) => campo,
        Err(_) => desconocido(format!("la app no contestó en {} ms", tope.as_millis())),
    }
}

/// La foto del campo tomada al parar la grabación (ver `tomar_foto_previa`).
static FOTO_PREVIA: Mutex<Option<(Instant, Campo)>> = Mutex::new(None);

/// Una foto más vieja que esto ya no describe el campo donde se va a pegar.
const VIGENCIA_FOTO: Duration = Duration::from_secs(120);

/// Se llama al parar la grabación: lee el campo en segundo plano MIENTRAS el servidor transcribe
/// (2-4 s). Así se le puede dar a la app todo `TOPE_EN_SEGUNDO_PLANO` sin sumarle un milisegundo
/// al dictado: antes la lectura iba justo antes de pegar, con 400 ms, y Chrome no alcanzaba.
pub fn tomar_foto_previa() {
    if let Ok(mut foto) = FOTO_PREVIA.lock() {
        *foto = None;
    }
    std::thread::spawn(|| {
        let campo = leer(TOPE_EN_SEGUNDO_PLANO);
        if let Ok(mut foto) = FOTO_PREVIA.lock() {
            *foto = Some((Instant::now(), campo));
        }
    });
}

/// El campo antes de pegar: la foto previa si está lista y es reciente (se usa una sola vez), o
/// una lectura rápida si no la hay (por ejemplo, "Pegar último dictado" desde la bandeja).
pub fn campo_antes_de_pegar() -> Campo {
    let foto = FOTO_PREVIA.lock().ok().and_then(|mut f| f.take());
    match foto {
        Some((cuando, campo)) if cuando.elapsed() < VIGENCIA_FOTO => campo,
        _ => leer(TOPE_ANTES_DE_PEGAR),
    }
}

/// Se llama al empezar a grabar. Chrome, Edge y las apps Electron no exponen el contenido de la
/// página a Accesibilidad hasta que alguien lo pide; si se pide justo al pegar, la primera lectura
/// llega vacía. Pidiéndolo al empezar el dictado, cuando se pega ya está listo.
pub fn preparar() {
    std::thread::spawn(plataforma::preparar);
}

/// Si Bloq Mayús está activado. Va al log de cada pegado: sospechamos que puede interferir con el
/// Cmd+V simulado (reporte de gMedic, 2026-10-28) y así lo sabremos con datos.
pub fn bloq_mayus() -> Option<bool> {
    plataforma::bloq_mayus()
}

/// ¿El texto dictado apareció en el campo?
///
/// Se compara solo lo alfanumérico y en minúsculas: algunos campos cambian los saltos de línea
/// (`\n` ↔ `\r\n`), los espacios o pasan todo a mayúsculas, y eso no significa que no entró. Se
/// cuenta cuántas veces aparece antes y después, por si el campo ya tenía ese mismo texto.
pub fn texto_entro(antes: &str, despues: &str, texto: &str) -> Option<bool> {
    let norm = |s: &str| -> String {
        s.chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(|c| c.to_lowercase())
            .collect()
    };
    let t = norm(texto);
    if t.is_empty() {
        return None;
    }
    Some(norm(despues).matches(&t).count() > norm(antes).matches(&t).count())
}

#[cfg(target_os = "macos")]
mod plataforma {
    use super::Campo;
    use core_foundation::base::{CFType, CFTypeRef, TCFType};
    use core_foundation::boolean::CFBoolean;
    use core_foundation::string::{CFString, CFStringRef};
    use std::collections::HashSet;
    use std::sync::Mutex;

    type AXUIElementRef = CFTypeRef;
    const AX_OK: i32 = 0;

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXUIElementCreateSystemWide() -> AXUIElementRef;
        fn AXUIElementCopyAttributeValue(
            element: AXUIElementRef,
            attribute: CFStringRef,
            value: *mut CFTypeRef,
        ) -> i32;
        fn AXUIElementSetAttributeValue(
            element: AXUIElementRef,
            attribute: CFStringRef,
            value: CFTypeRef,
        ) -> i32;
        fn AXUIElementIsAttributeSettable(
            element: AXUIElementRef,
            attribute: CFStringRef,
            settable: *mut u8,
        ) -> i32;
        fn AXUIElementSetMessagingTimeout(element: AXUIElementRef, seconds: f32) -> i32;
        fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> i32;
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceFlagsState(state_id: i32) -> u64;
    }

    /// Apps a las que ya se les pidió exponer su contenido (por pid), para no repetirlo.
    static PREPARADAS: Mutex<Option<HashSet<i32>>> = Mutex::new(None);

    const ROLES_DE_TEXTO: &[&str] = &["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"];

    /// El atributo, o el código de error de Accesibilidad (-25204 = no contestó a tiempo,
    /// -25212 = no hay valor, -25205 = la app no lo maneja…), para el log.
    fn atributo(elemento: AXUIElementRef, nombre: &str) -> Result<CFType, i32> {
        let nombre = CFString::new(nombre);
        let mut valor: CFTypeRef = std::ptr::null();
        let err = unsafe {
            AXUIElementCopyAttributeValue(elemento, nombre.as_concrete_TypeRef(), &mut valor)
        };
        if err != AX_OK {
            return Err(err);
        }
        if valor.is_null() {
            return Err(0);
        }
        Ok(unsafe { CFType::wrap_under_create_rule(valor) })
    }

    fn texto(elemento: AXUIElementRef, nombre: &str) -> Option<String> {
        atributo(elemento, nombre)
            .ok()?
            .downcast::<CFString>()
            .map(|s| s.to_string())
    }

    fn se_puede_escribir(elemento: AXUIElementRef) -> bool {
        let nombre = CFString::new("AXValue");
        let mut settable: u8 = 0;
        let err = unsafe {
            AXUIElementIsAttributeSettable(elemento, nombre.as_concrete_TypeRef(), &mut settable)
        };
        err == AX_OK && settable != 0
    }

    /// Lo que se espera a cada respuesta. El tope de verdad lo pone `super::leer`.
    const ESPERA_MENSAJE_S: f32 = 1.5;

    /// La app al frente (y el elemento del sistema), ya con el tope de espera puesto.
    fn app_al_frente() -> Result<(CFType, CFType), String> {
        let sistema = unsafe { AXUIElementCreateSystemWide() };
        if sistema.is_null() {
            return Err("sin elemento del sistema".into());
        }
        let sistema = unsafe { CFType::wrap_under_create_rule(sistema) };
        unsafe { AXUIElementSetMessagingTimeout(sistema.as_CFTypeRef(), ESPERA_MENSAJE_S) };
        let app = atributo(sistema.as_CFTypeRef(), "AXFocusedApplication")
            .map_err(|e| format!("sin app al frente (AX {e})"))?;
        unsafe { AXUIElementSetMessagingTimeout(app.as_CFTypeRef(), ESPERA_MENSAJE_S) };
        Ok((sistema, app))
    }

    /// Navegadores hechos sobre Chromium. Escuchan `AXEnhancedUserInterface` (el atributo que
    /// pone el lector de pantalla de Apple), NO `AXManualAccessibility`, que es de Electron: con
    /// solo ese, Chrome nunca exponía la página y todo salía "sin comprobar" (prueba del
    /// 2026-10-28).
    const NAVEGADORES_CHROMIUM: &[&str] = &[
        "Google Chrome",
        "Chromium",
        "Microsoft Edge",
        "Brave Browser",
        "Opera",
        "Vivaldi",
        "Arc",
    ];

    fn poner(app: &CFType, atributo: &str) -> i32 {
        let nombre = CFString::new(atributo);
        unsafe {
            AXUIElementSetAttributeValue(
                app.as_CFTypeRef(),
                nombre.as_concrete_TypeRef(),
                CFBoolean::true_value().as_CFTypeRef(),
            )
        }
    }

    /// Pide a la app que exponga su contenido a Accesibilidad: `AXManualAccessibility` para
    /// Electron (VS Code, Slack, WhatsApp de escritorio…) y `AXEnhancedUserInterface` para los
    /// navegadores Chromium. Las demás apps ignoran ambos. Se hace una vez por proceso y queda en
    /// el log con el código que devolvió cada uno.
    fn exponer_contenido(app: &CFType) {
        let mut pid: i32 = 0;
        if unsafe { AXUIElementGetPid(app.as_CFTypeRef(), &mut pid) } != AX_OK {
            return;
        }
        {
            let mut guard = match PREPARADAS.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            if !guard.get_or_insert_with(HashSet::new).insert(pid) {
                return;
            }
        }
        let nombre_app = texto(app.as_CFTypeRef(), "AXTitle").unwrap_or_else(|| "?".into());
        let manual = poner(app, "AXManualAccessibility");
        if NAVEGADORES_CHROMIUM.contains(&nombre_app.as_str()) {
            let mejorada = poner(app, "AXEnhancedUserInterface");
            log::info!(
                "Accesibilidad pedida a {nombre_app}: AXManualAccessibility={manual}, AXEnhancedUserInterface={mejorada}"
            );
        } else {
            log::info!("Accesibilidad pedida a {nombre_app}: AXManualAccessibility={manual}");
        }
    }

    pub fn preparar() {
        if let Ok((_, app)) = app_al_frente() {
            exponer_contenido(&app);
        }
    }

    pub fn leer() -> Campo {
        let (sistema, app) = match app_al_frente() {
            Ok(par) => par,
            Err(motivo) => return super::desconocido(motivo),
        };
        exponer_contenido(&app);
        let nombre_app = texto(app.as_CFTypeRef(), "AXTitle").unwrap_or_else(|| "?".into());

        // Primero se le pregunta a la app; si no contesta, al sistema (algunas apps solo
        // responden por ahí).
        let foco = match atributo(app.as_CFTypeRef(), "AXFocusedUIElement") {
            Ok(foco) => foco,
            Err(e_app) => match atributo(sistema.as_CFTypeRef(), "AXFocusedUIElement") {
                Ok(foco) => foco,
                Err(e_sis) => {
                    return super::desconocido(format!(
                        "app={nombre_app}, sin campo con el foco (AX {e_app} / {e_sis})"
                    ))
                }
            },
        };
        let Some(rol) = texto(foco.as_CFTypeRef(), "AXRole") else {
            return super::desconocido(format!("app={nombre_app}, el campo no dice su tipo"));
        };
        let valor = texto(foco.as_CFTypeRef(), "AXValue");
        let es_de_texto =
            ROLES_DE_TEXTO.contains(&rol.as_str()) || se_puede_escribir(foco.as_CFTypeRef());

        match valor {
            Some(valor) if es_de_texto => Campo::Texto {
                app: nombre_app,
                rol,
                valor,
            },
            _ => Campo::Otro { app: nombre_app, rol },
        }
    }

    pub fn bloq_mayus() -> Option<bool> {
        // kCGEventSourceStateCombinedSessionState = 0; kCGEventFlagMaskAlphaShift = 0x10000.
        let flags = unsafe { CGEventSourceFlagsState(0) };
        Some(flags & 0x0001_0000 != 0)
    }
}

#[cfg(target_os = "windows")]
mod plataforma {
    use super::Campo;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_MULTITHREADED,
    };
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationValuePattern, UIA_ComboBoxControlTypeId,
        UIA_DocumentControlTypeId, UIA_EditControlTypeId, UIA_ValuePatternId,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CAPITAL};

    pub fn preparar() {
        // Chrome y Edge encienden su accesibilidad solos cuando un cliente de UI Automation
        // pregunta; no hace falta pedírselo aparte como en macOS.
    }

    pub fn leer() -> Campo {
        // Hilo nuevo (ver `super::leer`): se inicializa COM aquí y se libera al salir.
        let iniciado = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
        let campo = leer_con_com()
            .unwrap_or_else(|e| super::desconocido(format!("UI Automation: {e}")));
        if iniciado {
            unsafe { CoUninitialize() };
        }
        campo
    }

    fn leer_con_com() -> windows::core::Result<Campo> {
        unsafe {
            let uia: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)?;
            let foco = uia.GetFocusedElement()?;
            let tipo = foco.CurrentControlType()?;
            // "Chrome", "Win32", "WPF"…: dice qué tipo de app es sin leer el título de la
            // ventana, que puede traer el nombre del paciente.
            let app = foco
                .CurrentFrameworkId()
                .map(|s| s.to_string())
                .unwrap_or_else(|_| "?".into());
            let rol = format!("{}", tipo.0);

            let es_de_texto = tipo == UIA_EditControlTypeId
                || tipo == UIA_DocumentControlTypeId
                || tipo == UIA_ComboBoxControlTypeId;
            if !es_de_texto {
                return Ok(Campo::Otro { app, rol });
            }
            let Ok(patron) = foco.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId)
            else {
                return Ok(Campo::Otro { app, rol });
            };
            if patron.CurrentIsReadOnly()?.as_bool() {
                return Ok(Campo::Otro { app, rol });
            }
            let valor = patron.CurrentValue()?.to_string();
            Ok(Campo::Texto { app, rol, valor })
        }
    }

    pub fn bloq_mayus() -> Option<bool> {
        Some(unsafe { GetKeyState(VK_CAPITAL.0 as i32) } & 1 != 0)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod plataforma {
    use super::Campo;

    pub fn preparar() {}

    pub fn leer() -> Campo {
        super::desconocido("plataforma sin soporte")
    }

    pub fn bloq_mayus() -> Option<bool> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::texto_entro;

    #[test]
    fn entro_en_campo_vacio() {
        assert_eq!(texto_entro("", "Paciente estable.", "Paciente estable."), Some(true));
    }

    #[test]
    fn no_entro_si_el_campo_no_cambio() {
        assert_eq!(texto_entro("Nota previa", "Nota previa", "Paciente estable."), Some(false));
    }

    #[test]
    fn entro_aunque_el_campo_cambie_saltos_de_linea_y_mayusculas() {
        let texto = "Tensión 120/80.\nFrecuencia 72.";
        let despues = "ANTES\r\nTENSIÓN 120/80.\r\nFRECUENCIA 72.";
        assert_eq!(texto_entro("ANTES", despues, texto), Some(true));
    }

    #[test]
    fn entro_cuando_el_campo_ya_tenia_ese_mismo_texto() {
        assert_eq!(texto_entro("Sin cambios.", "Sin cambios. Sin cambios.", "Sin cambios."), Some(true));
    }

    #[test]
    fn no_entro_si_pego_otra_cosa() {
        // El navegador leyó el portapapeles tarde y pegó lo que había antes.
        assert_eq!(texto_entro("", "texto viejo", "Paciente estable."), Some(false));
    }

    #[test]
    fn sin_letras_no_se_puede_saber() {
        assert_eq!(texto_entro("", " ", " . "), None);
    }
}
