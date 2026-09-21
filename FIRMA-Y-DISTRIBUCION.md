# FIRMA Y DISTRIBUCIÓN — CloseLabs Voice

> Todo lo que hay que saber para firmar la app en macOS y Windows, con lo investigado el
> **2026-09-20**, incluida la parte que más nos afecta: **qué puede y qué no puede hacer una
> persona o empresa colombiana**.
>
> Este documento existe porque dos caminos que dábamos por buenos resultaron cerrados para
> Colombia. Léelo antes de pagar nada.

---

## Resumen en diez líneas

| | macOS | Windows |
|---|---|---|
| **¿Se puede desde Colombia?** | Sí, sin problema | Sí, pero **no** con el servicio de Microsoft |
| **Costo** | $99/año | ~$309/año (certificado + firma en la nube) |
| **Como persona natural** | Sí, y es **convertible** a empresa después sin perder nada | Sí, y **ya no pierdes nada** frente a una empresa |
| **Qué resuelve** | El "app dañada" de Gatekeeper **y** el diálogo del llavero | El "Windows protegió su PC" y el bloqueo de Smart App Control |
| **Bloqueado para nosotros** | — | Azure Artifact Signing (ex Trusted Signing) |

**Decisión tomada (2026-09-20):** arrancar como **persona natural** en ambas plataformas.
CloseLabs no está constituida todavía y no está decidido si será en Colombia o en Estados Unidos.

---

## Por qué esto importa más de lo que parece

**Casi todos los médicos usan Windows.** Eso convierte la firma de Windows en la prioridad, no en
un pendiente cosmético. Sin firma, cada médico que instale ve una pantalla que dice que Windows lo
protegió de nuestro instalador — el momento exacto en que está decidiendo si nos paga $11 al mes.

---

# macOS

## Lo que cuesta y lo que resuelve

**$99/año**, Apple Developer Program. Resuelve dos cosas de un golpe:

1. **Gatekeeper.** Hoy un `.dmg` sin firmar solo abre en el computador que lo compiló. En
   cualquier otro Mac, macOS le pone cuarentena y lo declara dañado o de desarrollador no
   verificado. La única salida hoy es `xattr -cr` desde la Terminal, inviable para un médico.
2. **El llavero.** Sin firma, macOS ata el permiso del llavero al **hash exacto del binario**, así
   que cada versión nueva le pide al médico la contraseña de su Mac. Ya lo resolvimos sacando la
   sesión del llavero (ver `auth.rs`), pero firmar quita la causa de raíz.

## Persona natural vs organización — y por qué da igual empezar como persona

Apple **permite convertir** una cuenta de individual a organización más adelante:
*Membership Details → Convert to Organization*. Piden el D-U-N-S en ese momento, y lo importante:
**el Apple ID, el Team ID y los certificados sobreviven**. Solo cambia el nombre que se muestra.

Es decir: **nada de lo que firmes como persona se invalida cuando constituyas.** Empieza como
persona y olvídate del D-U-N-S hasta que exista la sociedad.

## ¿Puede un colombiano? Sí

El Apple Developer Program está disponible en **más de 220 países, Colombia incluida**. Requisitos
para inscribirse como persona:

- Apple ID con **verificación en dos pasos activada**.
- Ser mayor de edad.
- **Documento de identidad con foto emitido por el gobierno.** Apple acepta pasaporte en casi
  todas las regiones; la cédula puede servir, el pasaporte es la apuesta segura.
- ⚠️ **El nombre legal del Apple ID tiene que ser el nombre legal.** Apple advierte explícitamente
  que usar un alias, un apodo o el nombre de la empresa en los campos de nombre y apellido
  **retrasa la aprobación**. Para un colombiano: los dos apellidos, exactamente como en el
  documento.

## Pasos, en orden

1. Inscribirse en [developer.apple.com](https://developer.apple.com/programs/enroll/) — $99/año,
   renovación automática.
2. **Generar un CSR** desde Acceso a Llaveros en el Mac:
   *Asistente de certificados → Solicitar un certificado de una autoridad de certificación*.
3. **Crear el certificado `Developer ID Application`.** Ese exactamente — **no** "Mac App Store".
   Es el único que sirve para distribuir fuera de la tienda.
4. **Exportarlo a `.p12`** desde Acceso a Llaveros, con contraseña. Tiene que salir el certificado
   **junto con su clave privada**.
5. **Crear una contraseña específica de app** en [appleid.apple.com](https://appleid.apple.com) →
   *Inicio de sesión y seguridad → Contraseñas específicas para apps*. Es para notarizar; la
   contraseña normal de Apple **no sirve**.
6. **Copiar el Team ID** de developer.apple.com → *Membership*.

## Secretos del repo

Settings → Secrets and variables → Actions. **Nunca por chat ni por correo.**

| Secreto | Qué es |
|---|---|
| `APPLE_CERTIFICATE` | el `.p12` en base64 (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | la contraseña del `.p12` |
| `APPLE_ID` | el correo de la cuenta de Apple Developer |
| `APPLE_PASSWORD` | la contraseña específica de app |
| `APPLE_ID_PASSWORD` | la misma de arriba (el workflow usa los dos nombres) |
| `APPLE_TEAM_ID` | el Team ID |
| `KEYCHAIN_PASSWORD` | cualquier cadena aleatoria; solo abre un llavero temporal en el runner |

## Cambios de código pendientes

- `src-tauri/tauri.conf.json` → `hardenedRuntime: true`. **La notarización lo exige.**
- `src-tauri/tauri.conf.json` → quitar `signingIdentity: "-"`, que hoy fuerza la firma ad-hoc y
  ganaría sobre la variable de entorno que pone el CI.
- `.github/workflows/closelabs.yml` → `sign-binaries: true`.
- El entitlement `com.apple.security.cs.disable-library-validation` **se queda**: es el respaldo
  para el dylib de ONNX Runtime que carga el build de Intel.

El resto del pipeline ya está escrito en `build.yml` (heredado de Handy y adaptado).

---

# Windows

## El hallazgo que cambia la decisión: EV ya no compra nada

De la documentación de Microsoft, actualizada en agosto de 2026:

> *"EV certificates no longer bypass SmartScreen. Years ago, signing files with an Extended
> Validation (EV) code signing certificate would result in positive SmartScreen reputation by
> default, but this behavior no longer exists. [...] **Paying a premium for EV solely to avoid
> SmartScreen warnings is no longer justified.**"*

Eliminaron ese comportamiento en **2024**. Un certificado EV a nombre de una empresa recibe
**exactamente el mismo trato** que uno personal.

**Consecuencia directa para nosotros:** no hay ninguna razón para esperar a que CloseLabs exista.
Como persona natural obtienes hoy el mejor resultado disponible en Windows.

## Cómo funciona SmartScreen de verdad

Microsoft evalúa **dos señales**:

1. **Reputación del publisher** — ¿está firmado? ¿el certificado es de un publisher conocido?
2. **Reputación del hash del archivo** — ¿lo han descargado sin señales de comportamiento malicioso?

Y dos frases que definen nuestra estrategia:

> *"**Unsigned files must build reputation anew with every update.**"*

> *"There is no exact threshold, but it can take **several weeks and hundreds of clean installs
> from a wide audience**."*

**Lo que esto significa con nuestro tamaño:** con unas decenas de médicos **nunca** vamos a
acumular reputación por hash de archivo. Esa puerta está cerrada por volumen. La única palanca que
podemos mover es la **reputación del publisher**, que sí se hereda entre versiones — pero solo si
firmamos, y solo si **mantenemos la misma identidad**.

⚠️ Además: **Smart App Control** de Windows 11 puede **bloquear directamente** ejecutables sin
firma. No un "Ejecutar de todas formas" — un bloqueo, sin salida para el usuario.

⚠️ Y no existe mecanismo para pedirle a Microsoft que revise el archivo. La reputación se acumula
sola o no se acumula. (El portal de Security Intelligence es solo para administradores de TI en
entornos corporativos.)

## ❌ Azure Artifact Signing (ex Trusted Signing) — CERRADO para Colombia

Era el plan que teníamos anotado en el roadmap, a ~$10/mes. **No podemos usarlo.** De la
documentación de Microsoft:

> *"Public Trust certificates are available to organizations in the United States, Canada, the
> European Union, the United Kingdom, Australia, New Zealand, Japan, South Korea, Singapore,
> Switzerland, Norway, and Israel. **Individual developers must be located in the United States or
> Canada.**"*

**Colombia no está en ninguna de las dos listas.** Ni como empresa ni como persona.

Y hay un segundo muro: para las organizaciones que sí califican, exigen **tres años de historia
verificable**. Así que **constituir en Estados Unidos tampoco lo desbloquea** — una sociedad nueva
no califica hasta dentro de tres años.

Este camino está muerto para nosotros durante años, decidamos lo que decidamos sobre dónde
constituir. **No perder tiempo montando cuentas de Azure.**

## ❌ La Microsoft Store — no es el atajo que parece

La evalué precisamente porque todos nuestros usuarios están en Windows, y la Store es el único
lugar donde las advertencias desaparecen del todo (Microsoft refirma los paquetes).

**No aplica con Tauri.** De la documentación oficial de Tauri:

> *"Currently Tauri only generates EXE and MSI installers, so you must create a Microsoft Store
> application that **only links to the unpacked application**."*

O sea: la ficha en la Store **enlaza a nuestro propio instalador**, que se descarga y ejecuta por
fuera de la Store. SmartScreen aplica exactamente igual, y el instalador **hay que firmarlo de
todos modos**. Cero beneficio.

El beneficio real solo llega con **MSIX de verdad**, refirmado por Microsoft. Eso requiere:
- Salirse del camino oficial de Tauri (hay una guía del CLI `winapp` de Microsoft y empaquetadores
  de la comunidad, pero no es soportado de fábrica).
- Pasar la certificación de la Store.
- ⚠️ Y apostar a que aprueben una app que **inyecta pulsaciones de teclado en otras aplicaciones**
  y captura atajos globales. Es exactamente el perfil que las políticas miran con lupa.

**Conclusión: es un proyecto, no un atajo.** Anotarlo como idea a mediano plazo, no como solución.

## ✅ La opción real: SSL.com IV + eSigner

**~$309/año**, y es la única con soporte de CI de primera mano.

| Componente | Precio |
|---|---|
| Certificado **IV** (Individual Validated) | **$129/año** · $116,10/año a 2 años · **$109,65/año a 3 años** |
| **eSigner** Tier 1 (firma en la nube, 20 firmas/mes) | **$20/mes** o **$180/año** |
| **Total** | **~$309/año** |

**Por qué esta y no otra:**
- El IV **no requiere empresa registrada** — valida a la persona.
- eSigner es firma en la nube con HSM (FIPS 140-2 nivel 3) y **tiene GitHub Action propia** y
  documentación oficial de la integración.
- **30 días de prueba con firmas ilimitadas** → podemos montar y probar el pipeline completo antes
  de comprometer plata.

⚠️ **El token físico USB que ofrecen (+$379) NO sirve.** No se le puede enchufar un token a un
runner de GitHub. Si compras, tiene que ser con eSigner.

⚠️ **Ojo con el conteo de firmas.** Cada build firma el `.exe` de la app, el instalador NSIS y el
MSI — unas 3-4 firmas. Las 20/mes del Tier 1 dan para **unos 5 builds al mes**. Alcanza, pero si
hacemos una tanda de builds de prueba se puede agotar.

## ⚠️ Certum — más barato, descartado a propósito

Certum Cloud CODE Signing para desarrollador individual cuesta **desde ~$116** y también es en la
nube. Lo descarté por una razón concreta:

**SimplySign no se puede automatizar de fábrica.** Hay que autenticar una aplicación de escritorio
antes de que `signtool` pueda usar la llave — la clave privada no se carga hasta que SimplySign
autentica. La comunidad construyó parches (acciones de GitHub con auto-login por TOTP,
contenedores con sesión VNC, un cliente HTTPS que reimplementa el protocolo), pero son proyectos de
terceros sin garantía.

No vale la pena montar el pipeline del que depende toda la distribución sobre hacks no oficiales
para ahorrar ~$150 al año. **Si en el futuro Certum publica soporte oficial de CI, reconsiderar.**

## ❌ DigiCert — caro y sin opción individual

Desde **$399,99/año** el certificado base, más el costo aparte de KeyLocker (su HSM en la nube, con
licencias de 1.000 operaciones). Además DigiCert se enfoca en OV/EV para organizaciones, no en
certificados individuales. Fuera para nuestro caso.

## ¿Puede un colombiano? Casi con seguridad sí, pero hay que confirmarlo

SSL.com **no publica ninguna restricción de país** para certificados IV. Lo que sí publica son los
requisitos de validación, y ahí están los puntos que un colombiano debe mirar:

**Lo que piden:**
- Escaneo del **frente** de un documento de identidad con foto emitido por el gobierno, o la página
  de datos del pasaporte — con nombre, dirección, año de nacimiento y foto visibles.
- El **reverso** del documento.
- Una **selfie sosteniendo el documento junto a la cara**, mínimo 5 megapíxeles.
- (Alternativa) Validación automatizada con su herramienta de verificación de identidad por IA.
- Verificación de **dirección física** y **teléfono**.
- ⚠️ **Una llamada telefónica de vuelta a un número verificado es obligatoria antes de emitir.**
- No piden notarización.
- *"In some cases, SSL.com may request additional supporting documents before issuing a certificate."*

**Los tres puntos de fricción previsibles para un colombiano:**

1. **El documento.** La cédula debería servir, pero **el pasaporte es la apuesta segura** — es el
   documento que cualquier validador del mundo reconoce sin discutir. Si tienes pasaporte vigente,
   usa ese.
2. **La llamada de verificación.** Van a llamar a un número colombiano y tienen que poder
   *verificarlo* contra una fuente en línea. Este es el punto donde más se traba la gente fuera de
   Estados Unidos. Un número de línea fija a tu nombre, o un número que aparezca asociado a ti en
   algún directorio o registro público, ayuda.
3. **La dirección.** Van a pedir comprobante: factura de servicios públicos o extracto bancario
   reciente, con tu nombre y la dirección.

### ⚠️ Escribirle a ventas ANTES de pagar

Correo a **Support@SSL.com** (o el chat de ventas) preguntando exactamente esto:

1. ¿Emiten certificados **IV Code Signing** a una persona natural residente en **Colombia**?
2. ¿Aceptan **cédula de ciudadanía** colombiana, o exigen pasaporte?
3. ¿Cómo manejan la **llamada de verificación telefónica** a un número colombiano? ¿Qué cuenta como
   número verificable?
4. ¿Qué aceptan como **comprobante de dirección** en Colombia?
5. ¿Cuál es el **precio real de eSigner** comprado junto al certificado IV, y las 20 firmas/mes del
   Tier 1 cuentan por archivo firmado?
6. ¿Cuánto tarda la validación, en días hábiles?

**Plan B si rebotan:** Certum (asumiendo el costo de automatización no oficial), o esperar a
constituir en Estados Unidos y entrar como organización — donde el universo de CAs se abre entero.

## Cambios de código pendientes

⚠️ **Hay un hueco heredado de Handy.** El workflow instala `trusted-signing-cli` y pasa los
secretos `AZURE_*`, pero **no existe ningún `signCommand` en `tauri.conf.json`**. Es decir: hoy,
aunque tuviéramos credenciales, **no firmaría nada en Windows**.

Al comprar el certificado hay que:
- Añadir el `signCommand` en la configuración de Tauri apuntando al cliente de eSigner.
- Quitar del workflow el andamiaje de `trusted-signing-cli` y los secretos `AZURE_*`, que ya
  sabemos que nunca vamos a usar.
- Añadir los secretos de SSL.com (usuario, contraseña, credential ID y TOTP secret de eSigner).

---

# La decisión que sí cuesta plata: la identidad

**La reputación del publisher va atada al certificado.** Cambiar de identidad la reinicia.

- macOS: **no hay problema.** La conversión de individual a organización conserva el Team ID y los
  certificados.
- Windows: **no hay conversión.** Un certificado a nombre de CloseLabs es un certificado nuevo, con
  otro publisher, y la reputación acumulada vuelve a cero.

**Recomendación:** cuando CloseLabs se constituya, **considerar seguir firmando Windows como
persona natural más tiempo del que parecería natural.** Que el diálogo diga "Nicolás Walteros"
importa menos que reiniciar el contador justo cuando empiecen a entrar médicos en volumen. El
momento de cambiar de identidad es **antes** de una campaña de crecimiento, no durante.

---

# Sobre dónde constituir

Esto no es una decisión de firma, pero **dos hallazgos de esta investigación pesan en ella**:

1. **Azure Artifact Signing está cerrado en ambos escenarios.** Colombia no está en la lista, y una
   sociedad estadounidense nueva no cumple los tres años de historia. Que esto **no** empuje la
   decisión hacia Estados Unidos: no desbloquea nada.
2. **⚠️ Stripe NO opera en Colombia.** Verificado en la página oficial de Stripe: en América Latina
   solo soportan **Brasil y México**. Colombia no aparece ni en la lista de disponibles ni en la de
   "preview". Esto sí es un argumento fuerte para constituir en Estados Unidos, y está desarrollado
   en la nota de `BACKLOG.md` sobre la pasarela de pago.

Las CAs tradicionales (SSL.com, Certum) le venden a las dos. Así que, del lado de las firmas,
decide por impuestos, banca y clientes.

---

# Fuentes

**macOS**
- [Apple — Enrolling in the Apple Developer Program](https://developer.apple.com/programs/enroll/)
- [Apple — Updating your account information (conversión a organización)](https://developer.apple.com/help/account/membership/updating-your-account-information/)
- [Apple — Certificates overview](https://developer.apple.com/support/certificates/)

**Windows**
- [Microsoft — SmartScreen reputation for Windows app developers](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) *(la fuente clave: EV ya no sirve, reputación, Smart App Control)*
- [Microsoft — Artifact Signing quickstart (lista de países)](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart)
- [Microsoft — Artifact Signing FAQ](https://learn.microsoft.com/en-us/azure/artifact-signing/faq)
- [SSL.com — IV Code Signing Certificates](https://www.ssl.com/products/software-integrity/code-signing/iv/)
- [SSL.com — Requisitos de validación OV e IV](https://www.ssl.com/faqs/ssl-ov-validation-requirements/)
- [SSL.com — Precios de eSigner para code signing](https://www.ssl.com/guide/esigner-pricing-for-code-signing/)
- [SSL.com — Integración de eSigner con GitHub Actions](https://www.ssl.com/how-to/cloud-code-signing-integration-with-github-actions/)
- [Tauri — Microsoft Store](https://v2.tauri.app/distribute/microsoft-store/)

**Pasarela de pago**
- [Stripe — Disponibilidad global](https://stripe.com/global)

---

*Investigado y escrito el 2026-09-20. Los precios y las listas de países cambian — verificar contra
las fuentes antes de comprar.*
