//! CloseLabs Voice — sesión del médico (Fase 2).
//!
//! Hasta aquí la app no sabía quién la usaba. Esto añade cuenta: registrarse, entrar, y vincular
//! **este** computador a esa cuenta.
//!
//! ⚠️ **La sesión NO se usa para dictar.** El dictado sigue autenticándose con el token del
//! dispositivo. La razón está medida y escrita en la migración 20260920000003: el token de acceso
//! caduca a la hora, y meter una renovación en el camino del dictado significa que el día que
//! falle —un momento sin internet, el reloj del equipo desajustado— el médico se queda mudo a
//! mitad de consulta. La sesión se usa para lo que sí tolera esperar: entrar, ver la suscripción,
//! soltar un equipo.
//!
//! ⚠️ **El token de refresco va a un archivo propio, NO al llavero del sistema.** Estuvo en el
//! llavero y se sacó a propósito. Sin firma de Developer ID, macOS ata el permiso del llavero al
//! hash exacto del binario: cada versión nueva es, para el llavero, una app desconocida leyendo
//! un secreto ajeno, y le planta al médico una ventana pidiéndole la contraseña de su Mac. En la
//! primera pantalla de un producto clínico eso parece malware, y el médico llama asustado o no
//! vuelve a abrir la app. No es hipotético: apareció en cuanto se instaló la 0.7.0 encima de una
//! compilación anterior.
//!
//! El costo real de seguridad es casi nulo: el `device_token` —la credencial que de verdad
//! permite dictar— ya vive en texto plano en `settings_store.json`, en ESTA MISMA carpeta.
//! Proteger el refresco con el llavero mientras la otra puerta queda abierta era pagar una
//! ventana que asusta a cambio de nada. El archivo queda en 0600 y el refresco es revocable
//! desde el servidor, que es la defensa que sí sirve si alguien copia el disco.
//!
//! ⚠️ Lo que NO cambia: el refresco sigue **fuera de `settings_store.json`**. Ese archivo se
//! vuelca entero al log en cada arranque y viaja en los reportes de problema. Es la lección que
//! nos dejó el `device_token` apareciendo en claro en los logs.
//!
//! Cuando firmemos con Developer ID se podrá reconsiderar el llavero, pero ya sin urgencia.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::settings::get_settings;

/// Nombre del archivo de sesión dentro de la carpeta de datos de la app. Cambiarlo equivale a
/// cerrar la sesión de todo el mundo: lo guardado con el nombre anterior deja de encontrarse.
const ARCHIVO_SESION: &str = "sesion.json";

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);

/// Margen antes de dar por caducado el token. Sin él, una petición lanzada justo en el límite
/// llega al servidor ya vencida.
const MARGEN_CADUCIDAD: i64 = 60;

/// Lo que se guarda en el archivo de sesión.
#[derive(Serialize, Deserialize, Clone)]
struct Sesion {
    access_token: String,
    refresh_token: String,
    /// Segundos desde época a los que caduca `access_token`.
    expires_at: i64,
    user_id: String,
    email: String,
}

/// Respuesta de Supabase Auth al entrar o al renovar.
#[derive(Deserialize)]
struct RespuestaToken {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    user: UsuarioResp,
}

#[derive(Deserialize)]
struct UsuarioResp {
    id: String,
    email: Option<String>,
}

/// Error de Supabase Auth. Sus mensajes vienen en inglés y a veces son crípticos, así que la app
/// traduce el CÓDIGO; el texto original solo va al log.
#[derive(Deserialize)]
struct ErrorAuth {
    #[serde(default)]
    error_code: String,
    #[serde(default)]
    msg: String,
    #[serde(default)]
    error_description: String,
}

fn ahora() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn ruta_sesion(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::portable::app_data_dir(app).map_err(|e| format!("carpeta de datos: {e}"))?;
    Ok(dir.join(ARCHIVO_SESION))
}

/// Deja el archivo legible solo por su dueño.
///
/// Se llama ANTES de escribir, no después: si se ajustara al final, el token quedaría un instante
/// con los permisos que le tocaran por defecto. En Windows no hace falta — el perfil del usuario
/// ya restringe el acceso y el modo POSIX no significa nada allá.
fn solo_para_su_dueno(ruta: &Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = fs::set_permissions(ruta, fs::Permissions::from_mode(0o600)) {
            warn!("No se pudieron restringir los permisos de la sesión: {e}");
        }
    }
    #[cfg(not(unix))]
    let _ = ruta;
}

fn guardar_sesion(app: &AppHandle, s: &Sesion) -> Result<(), String> {
    let ruta = ruta_sesion(app)?;
    if let Some(padre) = ruta.parent() {
        fs::create_dir_all(padre).map_err(|e| format!("carpeta de datos: {e}"))?;
    }
    let json = serde_json::to_string(s).map_err(|e| format!("sesión: {e}"))?;

    // Crear vacío y cerrar la puerta antes de meter el secreto adentro.
    fs::write(&ruta, b"").map_err(|e| format!("sesión: {e}"))?;
    solo_para_su_dueno(&ruta);
    fs::write(&ruta, json).map_err(|e| format!("sesión: {e}"))
}

fn leer_sesion(app: &AppHandle) -> Option<Sesion> {
    let ruta = ruta_sesion(app).ok()?;
    match fs::read_to_string(&ruta) {
        Ok(json) => serde_json::from_str(&json)
            .map_err(|e| warn!("El archivo de sesión no se pudo entender: {e}"))
            .ok(),
        // No hay sesión guardada: es el caso normal en una instalación nueva, no un error.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => {
            warn!("No se pudo leer la sesión: {e}");
            None
        }
    }
}

fn borrar_sesion(app: &AppHandle) {
    let Ok(ruta) = ruta_sesion(app) else { return };
    match fs::remove_file(&ruta) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => warn!("No se pudo borrar la sesión: {e}"),
    }
}

fn cliente() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| format!("cliente http: {e}"))
}

/// Traduce el fallo de Supabase a un código nuestro, cerrado, que la interfaz sabe explicar.
async fn codigo_de_error(res: reqwest::Response) -> String {
    let status = res.status().as_u16();
    let cuerpo = res.json::<ErrorAuth>().await.ok();
    let (code, msg) = match cuerpo {
        Some(e) => (
            e.error_code.clone(),
            if e.msg.is_empty() { e.error_description } else { e.msg },
        ),
        None => (String::new(), String::new()),
    };
    // El texto de Supabase se queda en el log: puede traer el correo del médico.
    debug!("Auth devolvió {status} ({code}): {msg}");

    match (status, code.as_str()) {
        (400, "invalid_credentials") | (400, "invalid_grant") => "credenciales",
        (_, "email_not_confirmed") => "sin_confirmar",
        (_, "user_already_exists") | (422, _) if msg.contains("already") => "ya_existe",
        (429, _) | (_, "over_email_send_rate_limit") => "demasiados_intentos",
        (400, "weak_password") => "clave_debil",
        _ if status >= 500 => "servidor",
        _ => "desconocido",
    }
    .to_string()
}

/// URL base de Supabase, deducida de la del proxy para no tener dos ajustes que puedan
/// contradecirse: `…/functions/v1` cuelga del mismo proyecto que `…/auth/v1`.
fn base_supabase(app: &AppHandle) -> String {
    get_settings(app)
        .proxy_base_url
        .trim_end_matches('/')
        .trim_end_matches("/functions/v1")
        .to_string()
}

/// La llave pública del proyecto. **No es un secreto**: viaja en cada petición de cualquier
/// cliente de Supabase y por sí sola no abre nada — lo que se puede ver lo deciden las políticas
/// de la base. No tiene nada que ver con las llaves de proveedor que la Fase 1 sacó del binario.
fn anon_key(app: &AppHandle) -> String {
    get_settings(app).supabase_anon_key
}

// ---------------------------------------------------------------------------------------------
// Estado que ve la interfaz
// ---------------------------------------------------------------------------------------------

#[derive(Serialize, Clone, specta::Type)]
pub struct Equipo {
    pub id: String,
    pub label: Option<String>,
    pub platform: Option<String>,
    pub app_version: Option<String>,
    pub last_seen_at: Option<String>,
    /// `true` si es ESTE computador. La interfaz lo marca para que nadie se suelte a sí mismo
    /// por error creyendo que libera otro.
    pub is_this_device: bool,
}

#[derive(Serialize, Clone, specta::Type)]
pub struct EstadoCuenta {
    pub signed_in: bool,
    pub email: Option<String>,
    pub full_name: Option<String>,
    /// `trialing`, `active`, `past_due`, `canceled`, `incomplete`.
    pub status: Option<String>,
    pub trial_ends_at: Option<String>,
    pub current_period_end: Option<String>,
    pub cancel_at_period_end: bool,
    pub devices: Vec<Equipo>,
    pub max_devices: u32,
    /// Hay sesión guardada pero no se pudo hablar con el servidor. La app sigue dentro: lo que
    /// no sabe es el estado exacto de la suscripción.
    pub offline: bool,
}

impl EstadoCuenta {
    fn desconectado() -> Self {
        Self {
            signed_in: false,
            email: None,
            full_name: None,
            status: None,
            trial_ends_at: None,
            current_period_end: None,
            cancel_at_period_end: false,
            devices: Vec::new(),
            max_devices: 0,
            offline: false,
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Renovación
// ---------------------------------------------------------------------------------------------

/// Devuelve un token de acceso válido, renovándolo si hace falta.
///
/// Si la renovación falla porque el refresco ya no sirve (el médico cerró sesión en otro equipo,
/// o pasó demasiado tiempo), se borra la sesión: es preferible pedirle que entre de nuevo a
/// dejarlo con una sesión rota que falla en cada pantalla sin decir por qué.
async fn token_valido(app: &AppHandle) -> Option<String> {
    let sesion = leer_sesion(app)?;
    if sesion.expires_at - MARGEN_CADUCIDAD > ahora() {
        return Some(sesion.access_token);
    }

    debug!("El token de acceso caducó; renovando");
    let url = format!("{}/auth/v1/token?grant_type=refresh_token", base_supabase(app));
    let res = cliente()
        .ok()?
        .post(&url)
        .header("apikey", anon_key(app))
        .json(&serde_json::json!({ "refresh_token": sesion.refresh_token }))
        .send()
        .await
        .map_err(|e| warn!("No se pudo renovar la sesión: {e}"))
        .ok()?;

    if !res.status().is_success() {
        // 4xx = el refresco ya no vale. 5xx = problema de ellos, y entonces NO se borra la
        // sesión: un corte de su servidor no debe desconectar al médico.
        if res.status().is_client_error() {
            warn!("La sesión dejó de ser válida; hay que entrar de nuevo");
            borrar_sesion(app);
        }
        return None;
    }

    let t: RespuestaToken = res.json().await.ok()?;
    let nueva = Sesion {
        access_token: t.access_token.clone(),
        refresh_token: t.refresh_token,
        expires_at: ahora() + t.expires_in,
        user_id: t.user.id,
        email: t.user.email.unwrap_or(sesion.email),
    };
    let _ = guardar_sesion(app, &nueva);
    Some(t.access_token)
}

// ---------------------------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------------------------

/// Crea la cuenta. No inicia sesión: falta confirmar el correo.
#[tauri::command]
#[specta::specta]
pub async fn auth_sign_up(
    app: AppHandle,
    email: String,
    password: String,
    full_name: String,
    phone_country: String,
    phone: String,
) -> Result<(), String> {
    let url = format!("{}/auth/v1/signup", base_supabase(&app));
    let res = cliente()?
        .post(&url)
        .header("apikey", anon_key(&app))
        .json(&serde_json::json!({
            "email": email.trim().to_lowercase(),
            "password": password,
            "data": {
                "full_name": full_name.trim(),
                "phone_country": phone_country.trim(),
                "phone": phone.trim(),
                // El consentimiento se registra CON FECHA en el perfil. Ante la SIC hay que poder
                // demostrar cuándo se aceptó y qué versión de la política.
                "accepted_terms": "true",
                "terms_version": crate::settings::TERMS_VERSION,
            }
        }))
        .send()
        .await
        .map_err(|_| "sin_conexion".to_string())?;

    if !res.status().is_success() {
        return Err(codigo_de_error(res).await);
    }
    info!("Cuenta creada; falta confirmar el correo");
    Ok(())
}

/// Entra y vincula este computador a la cuenta.
///
/// Devuelve el estado completo para que la interfaz no tenga que pedirlo aparte justo después.
#[tauri::command]
#[specta::specta]
pub async fn auth_sign_in(
    app: AppHandle,
    email: String,
    password: String,
) -> Result<EstadoCuenta, String> {
    let url = format!("{}/auth/v1/token?grant_type=password", base_supabase(&app));
    let res = cliente()?
        .post(&url)
        .header("apikey", anon_key(&app))
        .json(&serde_json::json!({
            "email": email.trim().to_lowercase(),
            "password": password
        }))
        .send()
        .await
        .map_err(|_| "sin_conexion".to_string())?;

    if !res.status().is_success() {
        return Err(codigo_de_error(res).await);
    }

    let t: RespuestaToken = res.json().await.map_err(|_| "servidor".to_string())?;
    let sesion = Sesion {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: ahora() + t.expires_in,
        user_id: t.user.id,
        email: t.user.email.unwrap_or_else(|| email.trim().to_lowercase()),
    };
    guardar_sesion(&app, &sesion)?;
    info!("Sesión iniciada");

    // Vincular este equipo. Si rebota por el tope, la sesión SE QUEDA abierta a propósito: el
    // médico tiene que poder ver sus equipos y soltar uno, y para eso necesita estar dentro.
    if let Err(e) = vincular_este_equipo(&app).await {
        warn!("No se pudo vincular este equipo: {e}");
    }

    account_state(app).await
}

/// Vincula el dispositivo actual a la sesión abierta.
///
/// ⚠️ Un mismo computador puede pasar por varias cuentas: el médico se equivocó al registrarse, o
/// dos médicos comparten el computador del consultorio. El token de instalación pertenece a la
/// PRIMERA cuenta que lo vinculó, y el servidor no se lo quita a nadie en silencio
/// (`de_otra_cuenta` en `link_device`). Antes eso dejaba a la cuenta nueva con "0 de 3 equipos"
/// aunque estuviera usando la app, y peor: los dictados se le cobraban a la cuenta vieja, que es
/// la dueña del token. Por eso, cuando el equipo es de otra cuenta, esta instalación se registra
/// DE NUEVO (token nuevo, fila nueva) y se vincula con él. La cuenta anterior conserva el suyo.
async fn vincular_este_equipo(app: &AppHandle) -> Result<(), String> {
    match intentar_vincular(app).await {
        Err(e) if e == "de_otra_cuenta" => {
            warn!("Este equipo era de otra cuenta: se registra de nuevo para la actual");
            crate::proxy::olvidar_device_token(app);
            intentar_vincular(app).await
        }
        otro => otro,
    }
}

/// Un intento de vincular. El motivo que devuelve el servidor viaja tal cual en el error.
async fn intentar_vincular(app: &AppHandle) -> Result<(), String> {
    let token_dispositivo = crate::proxy::ensure_device_token(app)
        .await
        .ok_or_else(|| "sin_token_de_dispositivo".to_string())?;
    let acceso = token_valido(app).await.ok_or_else(|| "sin_sesion".to_string())?;

    let etiqueta = gethostname::gethostname().to_string_lossy().to_string();
    let url = format!("{}/account", get_settings(app).proxy_base_url.trim_end_matches('/'));

    let res = cliente()?
        .post(&url)
        .header("apikey", anon_key(app))
        .bearer_auth(&acceso)
        .json(&serde_json::json!({
            "action": "link",
            "device_token": token_dispositivo,
            "label": etiqueta,
        }))
        .send()
        .await
        .map_err(|_| "sin_conexion".to_string())?;

    // 409 = el servidor no pudo vincular y dice por qué: el tope de equipos de esta cuenta
    // (la interfaz lo muestra y el médico suelta uno) o que el equipo es de otra cuenta.
    if res.status() == reqwest::StatusCode::CONFLICT {
        #[derive(Deserialize)]
        struct Rechazo {
            #[serde(default)]
            motivo: String,
        }
        let motivo = res
            .json::<Rechazo>()
            .await
            .map(|r| r.motivo)
            .unwrap_or_default();
        return Err(if motivo.is_empty() {
            "tope_alcanzado".to_string()
        } else {
            motivo
        });
    }
    if !res.status().is_success() {
        return Err(format!("http_{}", res.status().as_u16()));
    }
    debug!("Este equipo quedó vinculado a la cuenta");
    Ok(())
}

/// Estado de la cuenta. Devuelve "desconectado" en vez de error cuando no hay sesión: para la
/// interfaz no es un fallo, es la pantalla de entrar.
#[tauri::command]
#[specta::specta]
pub async fn account_state(app: AppHandle) -> Result<EstadoCuenta, String> {
    // Primero el llavero. Si NO hay sesión guardada, el médico está fuera de verdad.
    let Some(sesion) = leer_sesion(&app) else {
        return Ok(EstadoCuenta::desconectado());
    };

    // Hay sesión. ⚠️ Que no se pueda renovar AHORA no significa que esté fuera: puede estar sin
    // internet, o nuestro servidor puede estar caído. Mandarlo a la pantalla de entrar en ese
    // momento sería el peor error posible — se queda sin poder dictar ni siquiera sin conexión,
    // por un problema que no es suyo. La sesión solo se borra cuando el servidor dice
    // explícitamente que el refresco ya no vale (ver `token_valido`).
    let Some(acceso) = token_valido(&app).await else {
        debug!("Hay sesión guardada pero no se pudo verificar; se sigue dentro");
        return Ok(EstadoCuenta {
            signed_in: true,
            email: Some(sesion.email),
            offline: true,
            ..EstadoCuenta::desconectado()
        });
    };

    let url = format!("{}/account", get_settings(&app).proxy_base_url.trim_end_matches('/'));
    let res = cliente()?
        .get(&url)
        .header("apikey", anon_key(&app))
        .bearer_auth(&acceso)
        .send()
        .await;

    let res = match res {
        Ok(r) => r,
        Err(e) => {
            debug!("Sin conexión al leer la cuenta ({e}); se sigue dentro");
            return Ok(EstadoCuenta {
                signed_in: true,
                email: Some(sesion.email),
                offline: true,
                ..EstadoCuenta::desconectado()
            });
        }
    };

    // El servidor no contestó bien, pero la sesión es válida: mismo criterio que arriba.
    if !res.status().is_success() {
        warn!("La cuenta devolvió {}; se sigue dentro", res.status());
        return Ok(EstadoCuenta {
            signed_in: true,
            email: Some(sesion.email),
            offline: true,
            ..EstadoCuenta::desconectado()
        });
    }

    #[derive(Deserialize)]
    struct Respuesta {
        profile: Option<Perfil>,
        subscription: Option<Suscripcion>,
        devices: Vec<EquipoResp>,
        max_devices: u32,
    }
    #[derive(Deserialize)]
    struct Perfil {
        full_name: String,
    }
    #[derive(Deserialize)]
    struct Suscripcion {
        status: String,
        trial_ends_at: Option<String>,
        current_period_end: Option<String>,
        #[serde(default)]
        cancel_at_period_end: bool,
    }
    #[derive(Deserialize)]
    struct EquipoResp {
        id: String,
        label: Option<String>,
        platform: Option<String>,
        app_version: Option<String>,
        last_seen_at: Option<String>,
    }

    let r: Respuesta = res.json().await.map_err(|_| "servidor".to_string())?;


    // Cuál de los equipos es este. Se compara por etiqueta y plataforma porque la app no conoce
    // su propio id en la base — nunca se lo devolvemos, y no hace falta para nada más.
    let esta_etiqueta = gethostname::gethostname().to_string_lossy().to_string();
    let esta_plataforma = std::env::consts::OS;

    Ok(EstadoCuenta {
        signed_in: true,
        email: Some(sesion.email),
        full_name: r.profile.map(|p| p.full_name),
        status: r.subscription.as_ref().map(|s| s.status.clone()),
        trial_ends_at: r.subscription.as_ref().and_then(|s| s.trial_ends_at.clone()),
        current_period_end: r
            .subscription
            .as_ref()
            .and_then(|s| s.current_period_end.clone()),
        cancel_at_period_end: r
            .subscription
            .as_ref()
            .map(|s| s.cancel_at_period_end)
            .unwrap_or(false),
        offline: false,
        devices: r
            .devices
            .into_iter()
            .map(|d| Equipo {
                is_this_device: d.label.as_deref() == Some(esta_etiqueta.as_str())
                    && d.platform.as_deref() == Some(esta_plataforma),
                id: d.id,
                label: d.label,
                platform: d.platform,
                app_version: d.app_version,
                last_seen_at: d.last_seen_at,
            })
            .collect(),
        max_devices: r.max_devices,
    })
}

/// Si hay una sesión guardada en este equipo. No dice si el token sigue vigente: para eso está
/// `account_state`. Sirve para lo que se decide sin internet, como dejar dictar o no.
pub fn hay_sesion(app: &AppHandle) -> bool {
    leer_sesion(app).is_some()
}

/// Suelta un equipo para hacerle sitio a otro. El servidor comprueba que sea de quien lo pide.
#[tauri::command]
#[specta::specta]
pub async fn auth_unlink_device(app: AppHandle, device_id: String) -> Result<(), String> {
    let acceso = token_valido(&app).await.ok_or_else(|| "sin_sesion".to_string())?;
    let url = format!("{}/account", get_settings(&app).proxy_base_url.trim_end_matches('/'));

    let res = cliente()?
        .post(&url)
        .header("apikey", anon_key(&app))
        .bearer_auth(&acceso)
        .json(&serde_json::json!({ "action": "unlink", "device_id": device_id }))
        .send()
        .await
        .map_err(|_| "sin_conexion".to_string())?;

    if !res.status().is_success() {
        return Err(format!("http_{}", res.status().as_u16()));
    }
    Ok(())
}

/// Manda el correo para cambiar la contraseña. Devuelve `Ok` aunque el correo no exista: decir
/// "esa cuenta no existe" le confirmaría a un desconocido quién es cliente nuestro.
#[tauri::command]
#[specta::specta]
pub async fn auth_send_recovery(app: AppHandle, email: String) -> Result<(), String> {
    let url = format!("{}/auth/v1/recover", base_supabase(&app));
    let res = cliente()?
        .post(&url)
        .header("apikey", anon_key(&app))
        .json(&serde_json::json!({ "email": email.trim().to_lowercase() }))
        .send()
        .await
        .map_err(|_| "sin_conexion".to_string())?;

    if res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err("demasiados_intentos".to_string());
    }
    Ok(())
}

/// Cierra la sesión en este equipo.
///
/// ⚠️ NO desvincula el dispositivo: el médico cierra sesión, no se muda de computador. Si
/// desvinculara, volver a entrar consumiría un cupo nuevo cada vez.
#[tauri::command]
#[specta::specta]
pub async fn auth_sign_out(app: AppHandle) -> Result<(), String> {
    if let Some(acceso) = token_valido(&app).await {
        let url = format!("{}/auth/v1/logout", base_supabase(&app));
        // Se avisa al servidor por cortesía, pero el resultado no importa: lo que de verdad
        // cierra la sesión es borrar el token de este equipo, y eso pasa igual.
        let _ = cliente()?
            .post(&url)
            .header("apikey", anon_key(&app))
            .bearer_auth(&acceso)
            .send()
            .await;
    }
    borrar_sesion(&app);
    info!("Sesión cerrada");
    // La interfaz vuelve a la pantalla de entrar. Sin esto, cerrar sesión solo cambiaba el panel
    // de cuenta y la app seguía entera y dictando hasta reiniciarla.
    let _ = app.emit("sesion-cerrada", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_caducidad_deja_margen() {
        // Un token que vence dentro de 30 s se considera caducado: si no, una petición lanzada
        // justo en el límite llega al servidor ya vencida.
        let casi = ahora() + 30;
        assert!(casi - MARGEN_CADUCIDAD <= ahora());

        // Uno con cinco minutos por delante sirve.
        let bueno = ahora() + 300;
        assert!(bueno - MARGEN_CADUCIDAD > ahora());
    }

    #[test]
    fn la_base_de_supabase_sale_de_la_del_proxy() {
        // Se deduce en vez de guardarse aparte para que no puedan contradecirse.
        let proxy = "https://gdizmbuzepxnkiahbeoz.supabase.co/functions/v1";
        let base = proxy
            .trim_end_matches('/')
            .trim_end_matches("/functions/v1");
        assert_eq!(base, "https://gdizmbuzepxnkiahbeoz.supabase.co");
    }
}
