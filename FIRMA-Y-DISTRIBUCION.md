# FIRMA Y DISTRIBUCIÓN — CloseLabs Voice

> Todo lo que hay que saber para firmar la app en macOS y Windows, con lo investigado el
> **2026-09-20**, incluida la parte que más nos afecta: **qué puede y qué no puede hacer una
> persona o empresa colombiana** — y qué se abre gracias al **socio español**.
>
> Léelo antes de pagar nada.

---

## Resumen

> ⚠️ **Punto de partida que lo condiciona todo: NO existe ninguna sociedad.** Ni en Colombia, ni en
> España, ni en Estados Unidos. Nicolás es persona natural colombiana y el socio español es
> **autónomo**, que legalmente también es persona física. Eso cierra todas las puertas que exigen
> una entidad jurídica.

| | macOS | Windows |
|---|---|---|
| **Opción elegida** | Apple Developer, persona natural | **SSL.com IV** a nombre de Nicolás |
| **Costo** | $99/año | **~$309/año** (certificado + eSigner) |
| **Qué resuelve** | El "app dañada" de Gatekeeper **y** el diálogo del llavero | El "Windows protegió su PC" y el bloqueo de Smart App Control |
| **Descartado** | — | Azure Artifact Signing: **exige una sociedad**, y no tenemos ninguna |

**Decisiones (2026-09-20):**
- **macOS: persona natural.** Apple permite convertir a organización después **sin perder el Team
  ID ni los certificados**, así que empezar como persona no cuesta nada.
- **Windows: SSL.com IV a nombre de Nicolás.** Es la única vía que no necesita que exista una
  empresa. Ventaja secundaria nada menor: la identidad queda **bajo su control**, no colgando de la
  entidad de un socio.
- **Cuando CloseLabs se constituya, reconsiderar Azure** (~$120/año y 5.000 firmas/mes, contra 20
  de SSL.com) — pero leyendo antes la sección sobre el costo de cambiar de identidad.

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

## ⏸️ Azure Artifact Signing (ex Trusted Signing) — exige una sociedad; para cuando exista

**~$9,99/mes (SKU Basic) con 5.000 firmas al mes.** Es la opción más barata, la más potente y la
que **nuestro CI ya tiene cableada** (`build.yml` ya instala `trusted-signing-cli` y pasa los
secretos `AZURE_*`; solo falta el `signCommand`).

**Quién puede entrar,** según la documentación de Microsoft:

> *"Public Trust certificates are available to organizations in the United States, Canada, **the
> European Union**, the United Kingdom, Australia, New Zealand, Japan, South Korea, Singapore,
> Switzerland, Norway, and Israel. **Individual developers must be located in the United States or
> Canada.**"*

- **Colombia:** ❌ no está en ninguna de las dos listas.
- **Persona natural española:** ❌ los individuos solo pueden ser de EE.UU. o Canadá.
- **Autónomo español:** ❌ **legalmente es persona física**, no una entidad jurídica. Hay reportes en
  Microsoft Q&A de autónomos y *sole proprietors* a los que el flujo de validación solo les ofrece
  verificación personal, nunca la subida de documentos de empresa. **Este es nuestro caso hoy.**
- **Sociedad española (S.L. u otra):** ✅ España está en la UE, así que calificaría. **No existe.**

**Hoy no nos sirve.** Queda documentado para el día que CloseLabs se constituya en un país de la
lista (España o Estados Unidos, por ejemplo).

### ⚠️ Corrección al primer borrador de este documento

La primera versión decía que hacía falta **tres años de historia verificable** y que por eso ni
constituir en Estados Unidos servía. **Eso estaba mal.** Ese dato venía de una respuesta generada
por IA en un hilo de Microsoft Q&A, no de la documentación.

En ese mismo hilo, un **empleado de Microsoft** respondió a la pregunta directa —"¿una LLC de 2025,
con menos de 3 años, califica bajo GA?"— así:

> *"Artifact Signing has country/region onboarding pre-reqs, **no minimum org age restrictions**."*

El requisito de los tres años fue una **restricción de la época de vista previa pública** (abril de
2025) y **no aparece en los prerrequisitos actuales de GA**. Lección: no dar por buenos los
resúmenes de búsqueda sin abrir la fuente.

⚠️ Dicho eso, **sigue apareciendo en hilos de soporte de 2026**, así que el equipo de validación
podría aplicarlo en la práctica. La validación tarda de **1 a 20 días hábiles** y solo hay **tres
intentos** para aportar documentos extra. Vale la pena intentarlo —cuesta muy poco— pero sin contar
con ello hasta tener el "Completed".

### Qué hará falta cuando exista la sociedad

1. **Suscripción de Azure de pago.** ⚠️ No sirven las cuentas gratuitas, de prueba ni
   patrocinadas.
2. **Tenant de Microsoft Entra.**
3. **Validación de identidad de organización**, que pide:
   - Nombre legal de la sociedad y su identificador fiscal (CIF/NIF).
   - **Un sitio web en el dominio propio de la sociedad.**
   - **Un correo monitoreado en ese mismo dominio** (no vale una lista de distribución, y tiene que
     poder recibir enlaces de remitentes externos; el enlace caduca a los 7 días).
   - Dirección de la sociedad.
   - Una **persona física** que haga la verificación de identidad con documento oficial, mediante
     AU10TIX y Verified ID en la app Microsoft Authenticator. El socio español encaja aquí.
4. Registrar el proveedor `Microsoft.CodeSigning`, crear la cuenta de Artifact Signing, el perfil
   de certificado **Public Trust**, y un **service principal** en Entra con el rol *Artifact
   Signing Certificate Profile Signer* → de ahí salen `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` y
   `AZURE_TENANT_ID`, que el workflow **ya espera**.

### ⚠️ El nombre que verá el médico

> *"you can't use a custom Common Name (CN) or a custom Organization (O) [...] CN values must
> always be the legal entity's validated name."*

El certificado llevará **el nombre legal de la sociedad**, tal como quede registrada. Eso es lo que
aparece en el diálogo de SmartScreen y en las propiedades del instalador. Si ese nombre no dice
nada a un médico colombiano, es una decisión de marca que hay que tomar a conciencia.

### Comparación

| | Azure Artifact Signing | SSL.com IV + eSigner |
|---|---|---|
| Costo | **~$120/año** | ~$309/año |
| Firmas incluidas | **5.000/mes** | 20/mes |
| Titular | Una sociedad (hoy no existe) | Persona natural colombiana |
| CI | **Primera mano, ya cableado** | GitHub Action propia, hay que montarla |
| Nombre en el diálogo | La razón social | "Nicolás Walteros" |
| Riesgo | La validación puede rebotar | Confirmar que emitan a Colombia |

**Hoy:** sin sociedad no hay Azure; vamos con SSL.com IV. **El día que exista la sociedad**, esta
tabla es el argumento para migrar — pesándolo contra el reinicio de reputación que implica cambiar
de identidad.

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

## ✅ La opción elegida: SSL.com IV + eSigner

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

⚠️ **Hay un hueco heredado de Handy.** El workflow ya instala `trusted-signing-cli` y ya pasa los
secretos `AZURE_*`, pero **no existe ningún `signCommand` en `tauri.conf.json`**. Es decir: hoy,
aunque tuviéramos credenciales, **no firmaría nada en Windows**. Es lo único que falta.

**Con SSL.com (lo elegido):** añadir el `signCommand` apuntando al cliente de eSigner y cargar sus
secretos del repo (usuario, contraseña, credential ID y TOTP secret de eSigner).

⚠️ **No borrar los pasos de `trusted-signing-cli` ni los secretos `AZURE_*` del workflow.** Hoy no
los usamos, pero son exactamente lo que hará falta el día que exista una sociedad y migremos a
Azure. Basta con que queden inactivos (dependen de `sign-binaries` y de que existan los secretos).

---

# La decisión que sí cuesta plata: la identidad

**La reputación del publisher va atada al certificado.** Cambiar de identidad la reinicia.

- macOS: **no hay problema.** La conversión de individual a organización conserva el Team ID y los
  certificados.
- Windows: **no hay conversión.** Pasar de "Nicolás Walteros" a "CloseLabs S.A.S." (o Inc., o
  S.L.) es un certificado nuevo, con otro publisher, y la reputación acumulada vuelve a cero.

**Recomendación:** firmar Windows como **Nicolás Walteros** desde el primer instalador, y
sostenerlo.

⚠️ **Cuando CloseLabs se constituya**, resistir el impulso de mover la firma de inmediato — aunque
Azure salga más barato. Que el diálogo diga "Nicolás Walteros" importa menos que reiniciar el
contador justo cuando empiecen a entrar médicos en volumen. El momento de cambiar de identidad es
**antes** de una campaña de crecimiento, nunca durante.

---

# Sobre dónde constituir

Dos hallazgos de esta investigación pesan en la decisión:

1. **Cobrar.** Stripe no opera en Colombia — en América Latina solo Brasil y México, verificado en
   su página oficial. ✅ **Resuelto sin sociedad:** la cuenta de Stripe existe a través del socio
   español.
2. **Firmar Windows barato.** Azure Artifact Signing solo emite a **organizaciones** en la UE,
   EE.UU. y un puñado de países más. ❌ **No resuelto:** ni la persona natural colombiana ni el
   autónomo español califican. Constituir en España o Estados Unidos **sí** lo desbloquearía
   (Microsoft confirma que **no hay antigüedad mínima**), y ahorraría ~$190/año con 250 veces más
   cuota de firmas.

Ese ahorro es real pero pequeño. **No es razón suficiente para constituir en un sitio u otro**:
decide por impuestos, banca y clientes, y trata Azure como un beneficio lateral.

⚠️ **Lo que sí conviene pensar:** hoy el cobro depende del socio (su cuenta de Stripe como
autónomo). No es un problema técnico, es un asunto entre socios — pero vale la pena que quede
acordado por escrito antes de construir encima, y es otra razón para que la firma de Windows quede
a nombre de Nicolás y no de una tercera entidad.

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
