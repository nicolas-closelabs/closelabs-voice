//! La huella de ESTE computador: un hash del identificador del hardware.
//!
//! Por qué (2026-11-14, Nicolás en su propio Mac): la app guarda un solo token por instalación, el
//! de la última cuenta que entró. Al volver a una cuenta anterior se pedía un token nuevo y su lista
//! mostraba el mismo Mac dos veces ("Computadores · 2 de 3"); además, como la app no sabía que esa
//! cuenta ya había usado este computador, le repetía el tutorial. Con la huella, el servidor reconoce
//! el computador aunque cambie el token (`link_device`, migración 20261114000001).
//!
//! De dónde sale:
//! - Mac: `IOPlatformUUID` (lo da `ioreg`; es el mismo de "Información del sistema").
//! - Windows: `MachineGuid` del registro (lo crea Windows al instalarse).
//!
//! Los dos sobreviven a cambiar de cuenta, reinstalar la app y borrar sus datos. Nunca sale el
//! identificador tal cual: se manda un SHA-256 con un prefijo propio, recortado a 32 caracteres, que
//! no sirve para cruzarlo con nada fuera de CloseLabs. Si no se puede leer, `None`: la app sigue
//! funcionando como antes (sin huella, el servidor no reemplaza nada).

use sha2::{Digest, Sha256};
use std::sync::OnceLock;

/// La huella (32 caracteres hexadecimales en minúscula), calculada una vez por arranque.
pub fn huella() -> Option<String> {
    static HUELLA: OnceLock<Option<String>> = OnceLock::new();
    HUELLA
        .get_or_init(|| {
            let id = identificador_del_hardware()?;
            let id = id.trim().to_lowercase();
            if id.is_empty() {
                return None;
            }
            let hash = Sha256::digest(format!("closelabs-voice/equipo/v1:{id}").as_bytes());
            let hex: String = hash.iter().map(|b| format!("{b:02x}")).collect();
            Some(hex[..32].to_string())
        })
        .clone()
}

#[cfg(target_os = "macos")]
fn identificador_del_hardware() -> Option<String> {
    let salida = std::process::Command::new("/usr/sbin/ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;
    let texto = String::from_utf8_lossy(&salida.stdout);
    // Renglón: `"IOPlatformUUID" = "1A2B3C4D-…"`
    texto
        .lines()
        .find(|l| l.contains("\"IOPlatformUUID\""))
        .and_then(|l| l.split('=').nth(1))
        .map(|v| v.trim().trim_matches('"').to_string())
}

#[cfg(windows)]
fn identificador_del_hardware() -> Option<String> {
    use winreg::{
        enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY},
        RegKey,
    };
    // KEY_WOW64_64KEY: que una app de 32 bits también lea la clave de 64 (es la misma para todas).
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey_with_flags(
            r"SOFTWARE\Microsoft\Cryptography",
            KEY_READ | KEY_WOW64_64KEY,
        )
        .ok()?
        .get_value::<String, _>("MachineGuid")
        .ok()
}

#[cfg(not(any(target_os = "macos", windows)))]
fn identificador_del_hardware() -> Option<String> {
    std::fs::read_to_string("/etc/machine-id").ok()
}
