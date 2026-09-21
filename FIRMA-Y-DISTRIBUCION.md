# FIRMA Y DISTRIBUCIÓN — CloseLabs Voice

> Cómo firmar la app en Windows y macOS, qué hace cada quien y en qué orden.
> Todo lo de aquí está verificado contra fuentes oficiales o confirmado por el proveedor.
> **Última actualización: 2026-09-21.**

---

## Estado actual

| | Windows | macOS |
|---|---|---|
| **Cómo** | Certificado **SSL.com IV** + firma en la nube **eSigner** | **Apple Developer Program** |
| **A nombre de** | Nicolás, como persona natural | Nicolás, como persona natural |
| **Costo** | ~$309/año | $99/año |
| **Estado** | ✅ **Luz verde para comprar.** SSL.com confirmó todo | Sin empezar |
| **Prioridad** | **Primero**: casi todos los médicos usan Windows | Después |

**Por qué a nombre de Nicolás:** no existe ninguna sociedad, en ningún país. Nicolás es persona
natural colombiana y el socio español es autónomo, que legalmente también es persona física. Las
dos opciones elegidas son las únicas que no exigen una empresa.

**Por qué importa:** sin firma, Windows le dice al médico que lo protegió de nuestro instalador,
justo cuando está decidiendo si nos paga $11 al mes. Y en Windows 11, **Smart App Control** puede
bloquear directamente un ejecutable sin firma, sin opción de "Ejecutar de todas formas".

---

# Windows — SSL.com IV + eSigner

## Lo que cuesta

| Componente | Precio |
|---|---|
| Certificado IV (Individual Validated), 1 año | **$129** |
| eSigner Tier 1 (firma en la nube, 20 firmas al mes) | **$20/mes** ($180/año pagando anual) |
| **Total** | **~$309/año** |

- **Garantía de devolución de 30 días** en el certificado.
- **eSigner da 30 días gratis con firmas ilimitadas**: ahí montamos y probamos el pipeline.
- Comprar **1 año** para empezar. El descuento de 3 años ($109,65/año) ahorra poco y conviene
  confirmar primero que todo funciona.

## Lo que confirmó SSL.com (2026-09-21)

Respondido en el chat de su web por **TrustBot, un agente de IA**. Lo que dijo coincide con su
documentación publicada, y la garantía de 30 días cubre el caso de que se equivoque.

| Pregunta | Respuesta |
|---|---|
| ¿Emiten IV a persona natural en Colombia? | **Sí** |
| ¿Qué documento? | **Cédula**, pasaporte o licencia de conducir, vigente, con foto y datos legibles |
| ¿Comprobante de dirección? | Solo si el documento no la muestra: factura de servicios, extracto bancario u otro documento oficial |
| ¿El teléfono tiene que estar a mi nombre? | **No**, ni ser de un país en particular. No piden documento que lo pruebe |
| ¿Cómo es la llamada de verificación? | En el pedido aparece **Perform Callback**. Eliges llamada automática, SMS, programada o manual; te dan un **código de 4 dígitos** y lo escribes en el navegador. Menos de 2 minutos |
| ¿Cuánto tarda la validación? | **2 a 3 días hábiles** desde que se envía todo completo |
| ¿Y si no pasa? | Garantía de devolución de 30 días |

## Lo que hace Nicolás

1. **Crear la cuenta** en [ssl.com](https://www.ssl.com) con una contraseña fuerte y única. Va a
   terminar guardada como secreto del CI, así que no reutilizar ninguna.
2. **Comprar el IV Code Signing de 1 año.** En *Key Storage & Delivery* elegir **eSigner**.
   ⚠️ **No el YubiKey** (+$379): es un token USB físico y no se puede conectar a los servidores de
   GitHub donde compilamos.
3. **Validar la identidad:**
   - Frente y reverso de la **cédula**.
   - **Selfie sosteniendo la cédula** junto a la cara (mínimo 5 megapíxeles).
   - Comprobante de dirección, si lo piden.
   - **Perform Callback:** pedir el código por SMS y escribirlo en el navegador.
4. **Esperar la emisión**: 2 a 3 días hábiles.
5. **Inscribir el certificado en eSigner.** Aparece un código QR y, junto a él, un **"secret code"**.
   ⚠️ **Copiar el secret code en un gestor de contraseñas ANTES de cerrar esa pantalla.** Es lo que
   le permite al CI firmar sin un celular. Si solo se escanea el QR, la firma automática no
   funciona. Escanear también el QR con una app de autenticación, por si alguna vez hay que firmar
   a mano.
6. **Activar eSigner Tier 1.** Los primeros 30 días son gratis.
7. **Cargar cuatro secretos en GitHub** (Settings → Secrets and variables → Actions). **Nunca por
   chat ni por correo.**

   | Secreto | Qué es |
   |---|---|
   | `ES_USERNAME` | el usuario de la cuenta de SSL.com |
   | `ES_PASSWORD` | la contraseña de esa cuenta |
   | `ES_CREDENTIAL_ID` | el identificador del certificado en eSigner (sale en el panel) |
   | `ES_TOTP_SECRET` | el secret code del paso 5 |

8. **Avisarle a Claude.**

## Lo que hace Claude, el mismo día

1. **Instalar CodeSignTool**, la herramienta de línea de comandos de SSL.com, en el servidor de
   Windows del CI.
2. **Añadir el `signCommand`** en una configuración de Tauri solo para Windows, que llame a
   CodeSignTool con los cuatro secretos.
3. **Separar la firma de Windows de la de Apple.** Hoy un solo interruptor del workflow
   (`sign-binaries`) activa las dos; como Apple aún no tiene certificado, encenderlo tal cual haría
   fallar el build de Mac.
4. **Probar durante los 30 días gratis**, y comprobar que queden firmados **el instalador y el
   `.exe` que se instala** (`Get-AuthenticodeSignature` en PowerShell).
5. **Contar cuántas firmas gasta cada build**, para confirmar que las 20 al mes alcanzan.

**Detalles técnicos que importan:**

- **Se usa el `signCommand` de Tauri, NO la GitHub Action de SSL.com.** La Action firma los
  archivos después del build: el `.exe` que queda instalado en el computador del médico se
  quedaría sin firma, y solo se firmaría el instalador. El `signCommand` firma primero la app y
  luego los instaladores.
- **Cada build gasta unas 3-4 firmas** (la app, el instalador NSIS y el MSI). Con 20 al mes salen
  unos 5 builds. Alcanza, pero una tanda de builds de prueba puede agotarlas.
- **Hoy el workflow no firmaría nada en Windows** aunque hubiera credenciales: lo heredamos de
  Handy con la herramienta de Azure instalada (`trusted-signing-cli` y secretos `AZURE_*`) pero sin
  ningún `signCommand`. **No borrar esos pasos**: quedan inactivos y son los que servirán el día
  que exista una sociedad (ver *Más adelante* abajo).
- **Por qué no se monta antes de tener las credenciales:** sin ellas no se puede probar, y un
  pipeline de firma montado a ciegas es justamente lo que heredamos de Handy — medio conectado y
  sin que nadie supiera que no firmaba.

## Qué esperar una vez firmado

Firmar **no elimina** el aviso de SmartScreen desde el primer día. Lo que cambia:

- El aviso muestra **el nombre del publisher verificado** en vez de "editor desconocido".
- Smart App Control deja de bloquear por falta de firma.
- **La reputación se acumula en el publisher y se hereda entre versiones.** Sin firma, cada
  actualización arranca de cero, para siempre.

La reputación por archivo individual pide, según Microsoft, *"semanas y cientos de instalaciones
limpias de una audiencia amplia"*: con decenas de médicos no la vamos a alcanzar. **Lo que sí
podemos construir es la reputación del publisher**, y para eso hay que mantener la misma identidad.
No hay forma de pedirle a Microsoft que revise el archivo: la reputación se acumula sola.

**Qué decirles a los primeros médicos:** que pueden ver un aviso de Windows la primera vez, que
revisen que el publisher sea Nicolás (su nombre legal completo, tal como sale en la cédula) y que
continúen.

Dato útil: desde 2024, **un certificado EV ya no da reputación instantánea**. Recibe el mismo
trato que uno IV. Firmar como persona natural no nos deja en desventaja frente a una empresa.

---

# Windows — Publicar en Microsoft Store

**Idea aprobada (2026-09-21), para después de tener la firma de SSL.com.** No reemplaza la
descarga directa: es un segundo canal, con el mismo instalador.

## Por qué

- El médico conoce la tienda: un botón **"Obtener"** en un sitio de Microsoft genera más confianza
  que un `.exe` bajado de una web que no conoce.
- **Cuesta casi nada**: la cuenta es **gratis para persona natural** desde 2025 (antes $19), con
  cédula y selfie, en casi 200 países. Encaja con la regla de la identidad: mismo nombre que la firma.
- **Cobro sin comisión**: en apps que no son juegos, Microsoft deja usar nuestro propio sistema de
  pagos sin quedarse con nada (política 10.8.1). La suscripción sigue funcionando como hoy.

## Etapa 1 — Subir el `.exe` firmado (poco trabajo)

Microsoft acepta instaladores EXE/MSI tradicionales desde 2021. Requisitos, y cómo quedamos:

| Requisito de Microsoft | Nosotros |
|---|---|
| Instalador y todos sus `.exe`/`.dll` **firmados** con una CA reconocida | ✅ Con SSL.com. **Por eso va después de la firma** |
| **Instalación silenciosa** (sin ventanas; el aviso de UAC sí se permite) | ✅ NSIS acepta `/S` |
| **URL versionada**: el archivo detrás del enlace no puede cambiar nunca | Publicar cada versión en un GitHub Release con su número |
| Instalador **completo**, que no descargue nada al instalarse | ⚠️ Configurar WebView2 en modo *offline installer* para la Store (Tauri lo explica). El modelo de Parakeet no cuenta: lo baja la app al abrir, no el instalador |
| El nombre del publisher no puede ser igual al del producto | ✅ "Nicolás Walteros" ≠ "CloseLabs Voice" |
| Las actualizaciones son responsabilidad nuestra | Cada versión nueva = una URL nueva en Partner Center |

**Qué hace Nicolás:** registrarse gratis en [storedeveloper.microsoft.com](https://storedeveloper.microsoft.com)
como *Individual developer*, con el mismo nombre legal que el certificado. Preparar la ficha:
descripción, capturas y política de privacidad (tiene que decir, con honestidad, que el audio sale
a nuestro servidor cuando hay internet).

**Qué hace Claude:** la configuración de Tauri para la Store (WebView2 offline), el Release
versionado y los parámetros de instalación silenciosa que pide Partner Center.

⚠️ **Lo que NO está confirmado:** que instalar desde la Store quite el aviso de SmartScreen. Con
EXE/MSI, la Store solo descarga y ejecuta **nuestro** instalador firmado, y Microsoft no lo vuelve a
firmar. Comprobarlo en la primera instalación real y **no prometérselo a los médicos** antes.

## Etapa 2 — Empaquetar en MSIX (mediano plazo)

MSIX es el formato nativo de la Store. Con él, **Microsoft firma el paquete gratis** y lo aloja en su
CDN: **cero SmartScreen garantizado** en ese canal.

- **Tauri no genera MSIX.** Hay que empaquetarlo aparte y mantener ese paso en el CI.
- La app se declara como app de escritorio con acceso completo (*runFullTrust*). La certificación
  revisa de cerca una app que captura atajos globales y escribe en otras aplicaciones.
- **No reemplaza a SSL.com:** la descarga directa desde nuestra web sigue necesitando la firma propia.

Vale la pena si la Store se vuelve el canal principal de instalación.

---

# macOS — Apple Developer Program

## Lo que resuelve

$99/año. Resuelve dos cosas:

1. **Gatekeeper.** Un `.dmg` sin firmar solo abre en el computador que lo compiló. En cualquier
   otro Mac aparece como dañado o de desarrollador no verificado, y la única salida es
   `xattr -cr` en la Terminal. Inviable para un médico.
2. **El llavero.** Sin firma, macOS ata el permiso del llavero al hash exacto del binario y le pide
   al médico la contraseña de su Mac con cada versión nueva. Ya lo esquivamos sacando la sesión del
   llavero (ver `auth.rs`); firmar quita la causa.

## Persona natural, sin miedo

Apple permite **convertir** la cuenta de individual a organización más adelante (*Membership
Details → Convert to Organization*, pidiendo el D-U-N-S en ese momento), y **el Apple ID, el Team
ID y los certificados se conservan**. Nada de lo firmado como persona se invalida al constituir.

Disponible en más de 220 países, Colombia incluida. Requisitos:

- Apple ID con **verificación en dos pasos**.
- Mayor de edad.
- Documento de identidad con foto (el pasaporte es el más aceptado).
- ⚠️ **El nombre del Apple ID tiene que ser el nombre legal exacto**, con los dos apellidos. Apple
  advierte que un alias o apodo retrasa la aprobación.

## Lo que hace Nicolás

1. Inscribirse en [developer.apple.com](https://developer.apple.com/programs/enroll/) ($99/año,
   renovación automática).
2. Generar un **CSR** desde Acceso a Llaveros: *Asistente de certificados → Solicitar un
   certificado de una autoridad de certificación*.
3. Crear el certificado **`Developer ID Application`**. Ese exactamente, **no** "Mac App Store".
4. **Exportarlo a `.p12`** con contraseña, incluyendo su clave privada.
5. Crear una **contraseña específica de app** en [appleid.apple.com](https://appleid.apple.com) →
   *Inicio de sesión y seguridad*. Es para notarizar; la contraseña normal no sirve.
6. Copiar el **Team ID** (developer.apple.com → *Membership*).
7. Cargar los secretos en GitHub. **Nunca por chat.**

   | Secreto | Qué es |
   |---|---|
   | `APPLE_CERTIFICATE` | el `.p12` en base64 (`base64 -i cert.p12 \| pbcopy`) |
   | `APPLE_CERTIFICATE_PASSWORD` | la contraseña del `.p12` |
   | `APPLE_ID` | el correo de la cuenta de Apple Developer |
   | `APPLE_PASSWORD` | la contraseña específica de app |
   | `APPLE_ID_PASSWORD` | la misma de arriba (el workflow usa los dos nombres) |
   | `APPLE_TEAM_ID` | el Team ID |
   | `KEYCHAIN_PASSWORD` | cualquier cadena aleatoria (abre un llavero temporal en el CI) |

## Lo que hace Claude

- `src-tauri/tauri.conf.json` → `hardenedRuntime: true` (la notarización lo exige).
- `src-tauri/tauri.conf.json` → quitar `signingIdentity: "-"`, que fuerza la firma ad-hoc y le
  ganaría a la identidad que pone el CI.
- Activar la firma de macOS en el workflow (para entonces ya separada de la de Windows).
- **Mantener** el entitlement `com.apple.security.cs.disable-library-validation`: es el respaldo
  para el dylib de ONNX Runtime que carga el build de Intel.

El resto del pipeline ya está en `build.yml`.

---

# La regla de la identidad

**En Windows, la reputación va atada al certificado, y no hay conversión.** Pasar de "Nicolás
Walteros" a "CloseLabs S.A.S." (o Inc., o S.L.) es un certificado nuevo, con otro publisher, y la
reputación acumulada vuelve a cero. En macOS no pasa: la conversión a organización conserva todo.

**Por eso:**
- Firmar Windows como **Nicolás Walteros** desde el primer instalador, y sostenerlo.
- Cuando CloseLabs se constituya, **no mover la firma de inmediato**. El momento de cambiar de
  identidad es **antes** de una etapa de crecimiento, nunca en medio.

---

# Más adelante: cuando exista una sociedad

## Azure Artifact Signing

El servicio de firma de Microsoft: **~$9,99/mes con 5.000 firmas al mes** (frente a ~$309/año y
20 firmas de SSL.com), y el workflow ya tiene instalada su herramienta.

**Hoy no se puede:** solo emite a **organizaciones** de EE.UU., Canadá, la Unión Europea, Reino
Unido, Australia, Nueva Zelanda, Japón, Corea del Sur, Singapur, Suiza, Noruega e Israel, y a
**individuos** solo de EE.UU. o Canadá. Colombia no está; un autónomo español es persona física.

**Si CloseLabs se constituye en uno de esos países:**
- Microsoft dice que **no hay antigüedad mínima** para la sociedad.
- ⚠️ Pero la validación se contrasta contra **registros públicos**, donde una sociedad recién creada
  casi no aparece. Hay varios casos de validaciones rechazadas sin explicación, y solo dan **tres
  intentos** para aportar documentos. Conviene tener antes el **D-U-N-S**.
- Pide: suscripción de Azure **de pago**, sitio web y correo **en el dominio de la sociedad**,
  identificador fiscal, dirección, y una persona que verifique su identidad con documento oficial.
- La validación tarda **1 a 20 días hábiles**.
- ⚠️ El certificado lleva **la razón social exacta**; no se puede personalizar. Ese es el nombre
  que verá el médico.

**Si fuera una LLC en Estados Unidos, lo realista son 2-3 meses** hasta poder firmar:

| Paso | Tiempo |
|---|---|
| Registrar la LLC | Unos días |
| EIN sin número de Seguro Social (formulario SS-4 por fax) | 2-4 semanas (4 días hábiles en el mejor caso) |
| D-U-N-S gratis | Hasta 30 días hábiles, a menudo 1-2 semanas |
| Validación de Azure | 1-20 días hábiles |

⚠️ **No crear una sociedad solo para esto.** Azure ahorra unos $190/año frente a SSL.com, y una LLC
con dueño extranjero cuesta más que eso al año en mantenimiento. Además tiene obligaciones con
multas grandes, como el **formulario 5472 del IRS** ($25.000 si no se presenta); confirmarlo con un
contador. Si la sociedad llega a existir por razones de negocio, probar Azure **en paralelo, sin
apagar SSL.com** hasta que la validación diga *Completed*, y teniendo en cuenta la regla de la
identidad.

---

# Descartado, y por qué

| Opción | Por qué no |
|---|---|
| **Azure Artifact Signing, hoy** | Exige una sociedad en un país de su lista. Ver *Más adelante* |
| **Certum** (~$116/año) | Más barato, pero su firma en la nube (SimplySign) necesita autenticar una app de escritorio antes de firmar. Automatizarlo en el CI solo se puede con parches de terceros sin garantía. Reconsiderar si publican soporte oficial |
| **DigiCert** (desde $399,99/año) | Caro, con el almacenamiento en la nube aparte, y enfocado en empresas |
| **Certificado EV** | Desde 2024 no da reputación instantánea en SmartScreen; recibe el mismo trato que uno IV. Además exige empresa |
| **Token USB (YubiKey)** | No se puede conectar a los servidores de GitHub donde compilamos |
| **Microsoft Store como sustituto de la firma** | Con EXE/MSI la Store exige nuestra firma igual y Microsoft no vuelve a firmar. Como **canal adicional** sí va: ver *Publicar en Microsoft Store* |
| **Mac App Store** | Exige el *sandbox* de Apple, donde no se concede el permiso de Accesibilidad con el que pegamos el texto: la app tendría que dejarlo en el portapapeles para que el médico pegue a mano. Además usamos APIs privadas de macOS para el overlay (`macOSPrivateApi`), que Tauri advierte que impiden publicar, y Apple exige su sistema de pagos (15-30% de comisión). Se distribuye fuera de la tienda, notarizado |

---

# Fuentes

**Windows**
- [Microsoft — SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) — reputación, EV, Smart App Control
- [SSL.com — IV Code Signing](https://www.ssl.com/products/software-integrity/code-signing/iv/)
- [SSL.com — Requisitos de validación OV e IV](https://www.ssl.com/faqs/ssl-ov-validation-requirements/)
- [SSL.com — Precios de eSigner](https://www.ssl.com/guide/esigner-pricing-for-code-signing/)
- [SSL.com — Automatizar eSigner (secret code y CodeSignTool)](https://www.ssl.com/how-to/automate-esigner-ev-code-signing/)
- [Microsoft — Artifact Signing: prerrequisitos y países](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- [Microsoft Q&A — antigüedad mínima de la sociedad](https://learn.microsoft.com/en-us/answers/questions/5977141/azure-artifact-signing-trusted-signing-is-a-us-llc)
- [Tauri — Microsoft Store](https://v2.tauri.app/distribute/microsoft-store/)
- [Microsoft — Requisitos para apps MSI/EXE en la Store](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msi/app-package-requirements) — firma, instalación silenciosa, URL versionada, ventajas de MSIX
- [Microsoft — Registro gratis para desarrolladores individuales](https://learn.microsoft.com/en-us/windows/apps/publish/whats-new-individual-developer)
- [Microsoft — Políticas de la Store (10.8.1, pagos de terceros)](https://learn.microsoft.com/en-us/windows/apps/publish/store-policies)

**macOS**
- [Apple — Inscripción en el Apple Developer Program](https://developer.apple.com/programs/enroll/)
- [Apple — Conversión de individual a organización](https://developer.apple.com/help/account/membership/updating-your-account-information/)

*Los precios y las listas de países cambian. Verificar contra las fuentes antes de pagar.*
