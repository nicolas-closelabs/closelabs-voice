# Términos y Condiciones y Política de Tratamiento de Datos — CloseLabs Voice · v1

> **Estado: v1 PUBLICADA en closelabs.co (2026-10-05).** El sitio salió de Lovable: el texto vive
> ahora en `closelabs-web/src/content/legal/*.md`, que se generó de este archivo. El abogado revisó el borrador y aprobó todas las
> respuestas sugeridas a sus preguntas (abajo). Una vez publicada se le vuelve a pasar; si hace
> falta una v2, la revisa él.
>
> **Cómo se usa:** pegar en Lovable el prompt de la Parte C. La versión "v1" coincide con la que la
> app registra al aceptar (`TERMS_VERSION` en `settings.rs`). **Si el texto cambia, sube la
> versión en los dos lados** y se vuelve a pedir la aceptación.

---

## Parte A — Lo que hay que saber del producto (hechos verificados en el código)

- **Empresa:** CLOSELABS LLC, Florida (EE.UU.), dos socios. 7345 W Sand Lake Rd, Ste 210, Office
  4824, Orlando, FL 32819, United States.
- **Producto:** app de escritorio (Windows y macOS) de dictado por voz para médicos.
- **Precio:** prueba de 30 días sin tarjeta; luego US$12 al mes, **impuestos incluidos**, por Stripe,
  renovación mensual. Hasta 3 computadores por cuenta.
- **Datos:** cuenta (nombre, correo, teléfono, contraseña cifrada, aceptación), computadores, métricas
  de uso SIN contenido (Supabase, servidores en Brasil). El audio y el texto de los dictados **no se
  guardan**: pasan por el servidor de CloseLabs al proveedor de IA (OpenAI; Groq, DeepInfra y
  OpenRouter de respaldo) y vuelven como texto. El diccionario queda en el computador. Sin internet,
  el audio no sale del computador. Pagos por Stripe; correos por Resend; web en Vercel; instaladores
  en GitHub; soporte por WhatsApp.
- **Proveedores de IA:** según sus condiciones para clientes de API, no usan los datos para entrenar,
  pero pueden retenerlos temporalmente (OpenAI, hasta 30 días para vigilar abusos).

## Parte B — Decisiones tomadas con el abogado (2026-10-04)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | Roles (Ley 1581) | Datos de pacientes: **médico o institución = Responsable; CloseLabs = Encargado**. Datos de la cuenta: CloseLabs = Responsable. El contrato de transmisión va **dentro de los Términos** (sección 9). |
| 2 | Datos sensibles y voz | CloseLabs asume las obligaciones de Encargado de datos sensibles. **La voz no es dato biométrico aquí**: no se usa para identificar a nadie ni se guarda. |
| 3 | Transferencia internacional | Autorización **expresa** del Usuario al registrarse + nivel adecuado de protección de los países de destino. |
| 4 | Retracto vs. sin reembolso | **Retracto de 5 días hábiles solo sobre el PRIMER cobro** de la suscripción (Ley 1480, art. 47); desde el segundo, sin reembolsos. |
| 5 | Ley aplicable | **Ley colombiana para Usuarios en Colombia**; Florida para los demás, sin perjuicio de los derechos irrenunciables de cada país. |
| 6 | Registro Nacional de Bases de Datos | Lo verifica el abogado (es un trámite, no un texto). |
| 7 | Responsabilidad clínica | "Herramienta de apoyo; el médico revisa antes de firmar". No es dispositivo médico: solo transcribe y puntúa. |
| 8 | Aceptaciones ya dadas ("v1" sin páginas) | **Pedir aceptación de nuevo una vez**, en la próxima versión de la app. |
| 9 | México y Perú | Se revisa al abrir esos países. |
| 10 | Tope de responsabilidad | **Lo pagado en los últimos 12 meses**, salvo lo que la ley no permita limitar. |

Datos completados: área de atención de datos = **CloseLabs** (contacto@closelabs.co); métricas de
uso = **24 meses**; quejas = **15 días hábiles**; la web **no usa cookies**.

⚠️ **Corrección al publicar (2026-10-05):** se había respondido "la web no usa analítica", pero el
sitio tiene **Vercel Web Analytics y Speed Insights** (miden visitas de forma agregada y sin cookies).
La sección 11 de la Política se ajustó para decirlo, y la fila de Vercel en la tabla de proveedores.
Pasarle este cambio al abogado en la revisión posterior a la publicación. Vigencia: fecha de
publicación, 5 de octubre de 2026.

**Lo que esto obliga a hacer en el producto** (anotado en el ROADMAP):
- Poder devolver el primer cobro si el Usuario se retracta dentro de 5 días hábiles (al principio, a
  mano desde Stripe, a pedido por correo o WhatsApp).
- Pedir aceptación de la v1 a quienes se registraron antes de publicarla.
- Separar la autorización **opcional** para recibir información de otros productos de CloseLabs
  (hoy el teléfono es obligatorio "también para otros productos": eso no vale como autorización).
- Si algún día la web pone cookies o analítica, actualizar la sección 11 de la Política.

---

## Parte C — Prompt para Lovable

> Copiar desde "Crea dos páginas" hasta el final.

```
Crea dos páginas legales nuevas en el sitio, con el mismo estilo visual del resto (colores,
tipografías, logo, encabezado y pie de página). Deben ser páginas de lectura cómoda: ancho de
texto moderado (unos 70 caracteres por línea), buena separación entre secciones, títulos de
sección claros, una tabla de contenido al inicio con enlaces a cada sección, y verse bien en
computador y en celular. Nada con aspecto de plantilla de IA (sin gradientes, sin emojis, sin
íconos decorativos). Usa EXACTAMENTE el texto que va abajo, sin resumirlo ni reescribirlo.
Las tablas deben verse como tablas. Enlaza las dos páginas entre sí donde se mencionan, y desde
el pie de página de todo el sitio ("Términos" y "Privacidad").

========================================
PÁGINA 1 — ruta /terminos
========================================

# Términos y Condiciones de Uso de CloseLabs Voice

Versión 1 · Vigentes desde el 5 de octubre de 2026

## 1. Quiénes somos

CloseLabs Voice es un servicio de CLOSELABS LLC, sociedad constituida en el Estado de Florida,
Estados Unidos de América, con domicilio en 7345 W Sand Lake Rd, Ste 210, Office 4824, Orlando,
FL 32819, United States ("CloseLabs", "nosotros"). Correo: contacto@closelabs.co ·
WhatsApp: +57 310 299 1182.

Al crear una cuenta o usar CloseLabs Voice, usted ("el Usuario") acepta estos Términos y la
Política de Tratamiento de Datos Personales (/privacidad). Si no está de acuerdo, no use el
servicio.

## 2. Qué es el servicio

CloseLabs Voice es una aplicación de escritorio para Windows y macOS que convierte la voz del
Usuario en texto y lo pega en el programa que tenga abierto. Con conexión a internet, el audio se
envía a los servidores de CloseLabs y a proveedores de inteligencia artificial que lo transcriben y
le dan formato (puntuación, mayúsculas, eliminación de muletillas y aplicación de las correcciones
habladas, como "mentira" o "me equivoqué"). Sin conexión, la transcripción se hace dentro del
computador del Usuario, con menor calidad.

El servicio está pensado para profesionales de la salud que dictan notas, historias clínicas y
otros documentos.

## 3. Herramienta de apoyo: el Usuario revisa lo que firma

CloseLabs Voice es una herramienta de escritura. **No es un dispositivo médico, no diagnostica, no
recomienda tratamientos y no reemplaza el criterio del profesional.**

La transcripción y el formato automáticos pueden cometer errores: palabras mal escritas, términos
confundidos, números cambiados u omitidos. **El Usuario debe revisar y corregir todo texto antes de
incorporarlo a una historia clínica o a cualquier documento, y es el único responsable de su
contenido.**

## 4. La cuenta

- Para usar el servicio se necesita una cuenta con datos verdaderos: nombre, correo y teléfono.
- **La cuenta es personal e intransferible.** Puede usarse en hasta tres (3) computadores del mismo
  Usuario. No se permite compartirla con otras personas.
- El Usuario es responsable de mantener su contraseña en secreto y de lo que se haga con su cuenta.
- El Usuario declara tener capacidad legal para contratar.

## 5. Prueba gratis, precio y pago

- **Prueba gratis:** 30 días desde el registro, sin necesidad de tarjeta.
- **Precio:** US$12 (doce dólares de los Estados Unidos) al mes, **impuestos incluidos**.
- **Cómo se paga:** con tarjeta, a través de Stripe, nuestro procesador de pagos. CloseLabs no ve
  ni guarda los datos de la tarjeta.
- **Renovación automática:** la suscripción se renueva y se cobra cada mes hasta que el Usuario la
  cancele.
- **Pago rechazado:** si un cobro no pasa, el procesador lo reintenta durante algunos días; mientras
  tanto el servicio sigue funcionando y le avisamos al Usuario para que actualice su tarjeta. Si los
  reintentos fallan, el servicio se suspende hasta que se complete el pago.
- **Cambios de precio:** avisaremos con al menos 30 días de anticipación. El nuevo precio aplica
  desde el período siguiente al aviso, y el Usuario puede cancelar antes si no está de acuerdo.
- El banco del Usuario puede cobrar comisiones por compras internacionales o por conversión de
  moneda; esas comisiones no dependen de CloseLabs.

## 6. Cancelación, retracto y reembolsos

- El Usuario puede cancelar **en cualquier momento, desde "Mi cuenta" en la aplicación**, sin
  llamar ni escribir a nadie.
- Al cancelar, **el servicio sigue funcionando hasta el último día del período ya pagado**, y no
  se vuelve a cobrar. Hasta esa fecha el Usuario puede reanudar la suscripción.
- **Derecho de retracto:** dentro de los cinco (5) días hábiles siguientes al **primer cobro** de la
  suscripción, el Usuario puede retractarse escribiendo a contacto@closelabs.co o por WhatsApp. Le
  devolveremos el valor de ese primer cobro dentro de los treinta (30) días calendario siguientes,
  y la suscripción se cancelará (artículo 47 de la Ley 1480 de 2011).
- **Fuera del derecho de retracto, no hay reembolsos por la parte no usada de un período**, porque
  el servicio sigue disponible hasta su final.
- Durante la prueba gratis no hay nada que cancelar: si al terminar no se agrega una tarjeta, la
  prueba simplemente termina.
- Cancelar no borra la cuenta. Para eliminar la cuenta y sus datos, ver la sección 10.

Si el Usuario accedió al servicio a través de un aliado comercial que gestiona su facturación, la
cancelación y los pagos se gestionan con ese aliado.

## 7. Uso permitido

El Usuario se compromete a no:
- Usar el servicio para fines ilegales o para tratar datos de personas sin la autorización que exija
  la ley.
- Intentar acceder a los sistemas de CloseLabs o de sus proveedores por medios no autorizados, ni
  copiar, descompilar o revender el servicio.
- Usar el servicio de forma automatizada o masiva que afecte su funcionamiento para otros usuarios.

Hay un límite diario de uso por computador, muy por encima de lo que dicta un profesional en una
jornada, que protege el servicio de abusos.

## 8. Datos de pacientes: roles de cada parte

Cuando el Usuario dicta información de sus pacientes, **el Usuario (o la institución para la que
trabaja) es el Responsable del tratamiento** de esos datos, y **CloseLabs actúa como Encargado**:
los trata solo para prestar el servicio y por cuenta del Usuario.

El Usuario declara que cuenta con la autorización de sus pacientes y con las demás condiciones
legales para tratar sus datos, incluidos los datos de salud, que la ley considera sensibles, y que
cumple las normas sobre historia clínica que le apliquen.

## 9. Acuerdo de transmisión de datos personales

Este acuerdo regula la transmisión de los datos de pacientes del Usuario (Responsable) a CloseLabs
(Encargado), conforme al artículo 2.2.2.25.5.2 del Decreto 1074 de 2015.

**Alcance:** CloseLabs trata el audio y el texto de los dictados **únicamente para transcribirlos y
darles formato** y devolver el texto al Usuario. No los trata para ningún otro fin.

**Obligaciones de CloseLabs como Encargado:**
- Tratar los datos según los principios de la Ley 1581 de 2012 y las instrucciones del Usuario
  descritas en este acuerdo.
- **No guardar** el audio ni el texto de los dictados en sus sistemas.
- No usarlos para entrenar modelos de inteligencia artificial, para perfilar a nadie ni para ningún
  fin propio. **La voz no se usa para identificar a ninguna persona.**
- Usar solo proveedores (subencargados) que se obliguen a condiciones de confidencialidad y
  seguridad equivalentes, que se listan en la Política de Tratamiento de Datos.
- Mantener medidas de seguridad técnicas y administrativas razonables (comunicaciones cifradas,
  acceso restringido, registros técnicos sin contenido de dictados).
- Guardar confidencialidad sobre los datos, aun después de terminada la relación.
- Informar al Usuario, sin demora injustificada, de cualquier incidente de seguridad que afecte esos
  datos, y apoyarlo en lo necesario para atenderlo.
- Apoyar al Usuario para que pueda atender las solicitudes de los titulares (sus pacientes).

**Obligaciones del Usuario como Responsable:** contar con la autorización de los titulares, informarles
del tratamiento, y dictar solo los datos necesarios para la finalidad clínica.

**Transferencia internacional:** para prestar el servicio, los datos pasan por servidores en los
Estados Unidos y Brasil, según se detalla en la Política de Tratamiento de Datos. El Usuario lo
autoriza al aceptar estos Términos.

## 10. Eliminar la cuenta

El Usuario puede eliminar su cuenta en cualquier momento desde "Mi cuenta". Al eliminarla se borran
su perfil, sus computadores registrados y el estado de su suscripción; si hay una suscripción
activa, se cancela primero. Algunos registros pueden conservarse el tiempo que exija la ley (por
ejemplo, contables).

## 11. Disponibilidad del servicio

Hacemos lo razonable para que el servicio funcione siempre, con proveedores de respaldo automático.
Pero depende de internet y de terceros, y **no garantizamos que funcione sin interrupciones ni
errores**. Sin conexión, la aplicación sigue transcribiendo dentro del computador, con menor calidad.

Podemos actualizar la aplicación, cambiar proveedores o mejorar funciones. Si un cambio afecta de
forma importante el servicio contratado, avisaremos con anticipación.

## 12. Propiedad intelectual

La aplicación, la marca CloseLabs y sus contenidos son de CloseLabs o de sus licenciantes.
Otorgamos al Usuario una licencia personal, limitada, no exclusiva e intransferible para usar la
aplicación mientras su cuenta esté activa.

**El texto que el Usuario dicta es suyo.** CloseLabs no adquiere ningún derecho sobre él.

La aplicación incluye software de código abierto, en particular Handy (MIT License, © CJ Pais),
cuyas licencias se respetan y se pueden consultar en la aplicación.

## 13. Responsabilidad

CloseLabs no responde por:
- El contenido de los documentos que el Usuario firme o use sin revisar (ver sección 3).
- Daños causados por un uso contrario a estos Términos.
- Fallas de internet, del computador del Usuario o de servicios de terceros fuera de nuestro control.

En la medida en que la ley lo permita, la responsabilidad total de CloseLabs frente al Usuario por
cualquier causa se limita al **valor que el Usuario haya pagado por el servicio en los doce (12)
meses anteriores** al hecho que la origine.

Nada de lo anterior limita los derechos que la ley le reconoce al Usuario como consumidor ni la
responsabilidad que, según la ley, no puede limitarse.

## 14. Suspensión y terminación

Podemos suspender o cerrar una cuenta que incumpla estos Términos (por ejemplo, una cuenta
compartida o un uso abusivo), avisándole al Usuario y, cuando sea posible, dándole la oportunidad
de corregirlo.

## 15. Cambios a estos Términos

Si cambiamos estos Términos, publicaremos la nueva versión con su fecha y avisaremos al Usuario en
la aplicación o por correo antes de que entre en vigor. Si el cambio es importante, le pediremos
aceptarlo de nuevo; si no está de acuerdo, puede cancelar.

## 16. Peticiones, quejas y reclamos

El Usuario puede escribirnos a contacto@closelabs.co o por WhatsApp al +57 310 299 1182.
Respondemos en un plazo máximo de **quince (15) días hábiles**.

## 17. Ley aplicable

**Para Usuarios en Colombia**, estos Términos se rigen por la ley colombiana, incluidos el Estatuto
del Consumidor (Ley 1480 de 2011) y la Ley 1581 de 2012, y cualquier controversia se resolverá ante
las autoridades y jueces colombianos competentes.

**Para Usuarios de otros países**, se rigen por las leyes del Estado de Florida, Estados Unidos, sin
perjuicio de los derechos irrenunciables que les reconozca la ley de su país.

========================================
PÁGINA 2 — ruta /privacidad
========================================

# Política de Tratamiento de Datos Personales de CloseLabs Voice

Versión 1 · Vigente desde el 5 de octubre de 2026

## 1. Responsable del tratamiento

CLOSELABS LLC
Domicilio: 7345 W Sand Lake Rd, Ste 210, Office 4824, Orlando, FL 32819, United States
Correo: contacto@closelabs.co
WhatsApp: +57 310 299 1182

Esta Política se expide en cumplimiento de la Ley 1581 de 2012, el Decreto 1074 de 2015 (que
compila el Decreto 1377 de 2013) y demás normas colombianas de protección de datos personales.

## 2. Resumen en simple

- **No guardamos el audio ni el texto de sus dictados.** Pasan por nuestro servidor y por un
  proveedor de inteligencia artificial solo para convertirlos en texto, y no se usan para entrenar
  modelos.
- **Sin internet, el audio no sale de su computador.**
- Guardamos lo necesario para su cuenta (nombre, correo, teléfono) y métricas de uso **sin
  contenido** (cuándo dictó y cuánto duró, nunca qué dijo).
- **Nunca vendemos sus datos.**
- Puede consultar, corregir o eliminar sus datos cuando quiera.

## 3. Qué datos tratamos y para qué

| Dato | Finalidad |
|---|---|
| Nombre, correo, teléfono con indicativo, contraseña (guardada cifrada) | Crear y administrar su cuenta, comunicarnos con usted sobre el servicio, darle soporte |
| Fecha y versión en que aceptó estos textos | Demostrar su autorización |
| Identificador y nombre de sus computadores, sistema operativo, versión de la aplicación, última conexión | Permitir hasta tres computadores por cuenta y proteger la cuenta |
| Métricas de uso: fecha y hora de cada dictado, duración del audio, cantidad de texto, tiempo de respuesta, errores. **Sin el contenido** | Aplicar los límites de uso, facturar, detectar y corregir fallas, mejorar el servicio |
| Estado de su suscripción | Saber si el servicio está activo. **Los datos de su tarjeta los trata Stripe**; nosotros no los vemos |
| Audio y texto de los dictados | Únicamente transcribir y dar formato. **No se guardan** (ver sección 4) |
| Diccionario personal | Mejorar la escritura de sus términos. Se guarda solo en su computador |
| Registro técnico de la aplicación, si usted reporta un problema | Soporte. Se envía limpio de texto de dictados y solo si usted lo decide |

**Comunicaciones:** usamos su correo y su teléfono para temas de su cuenta y del servicio. Solo le
enviaremos información de otros productos de CloseLabs si usted lo autoriza aparte; esa
autorización es **opcional** y puede retirarla en cualquier momento.

## 4. Los dictados y los datos de sus pacientes

Sus dictados pueden contener datos de salud de sus pacientes, que la ley considera **datos
sensibles**. Sobre esos datos:

- **Usted (o su institución) es el Responsable** del tratamiento, y CloseLabs actúa como
  **Encargado**: los trata por cuenta suya y solo para prestarle el servicio, según el acuerdo de
  transmisión de la sección 9 de los Términos.
- Usted debe contar con la autorización de sus pacientes y cumplir las normas de historia clínica.
- **CloseLabs no guarda el audio ni el texto.** Viajan cifrados a nuestro servidor, de ahí al
  proveedor de inteligencia artificial que los procesa, y el texto vuelve a su computador.
- **La voz no se usa para identificar a ninguna persona.**
- Nuestros proveedores de inteligencia artificial **no usan esos datos para entrenar modelos**,
  según sus condiciones para clientes de API, pero **pueden conservarlos por un tiempo limitado**
  para seguridad y prevención de abusos (por ejemplo, OpenAI hasta 30 días), según sus propias
  políticas.
- **Sin conexión a internet**, la transcripción se hace dentro de su computador y el audio no sale.

## 5. Con quién compartimos datos y transferencias internacionales

No vendemos ni alquilamos datos personales. Los compartimos solo con estos proveedores, que los
tratan por cuenta nuestra y bajo obligaciones de confidencialidad y seguridad:

| Proveedor | País | Para qué |
|---|---|---|
| OpenAI | Estados Unidos | Transcribir y dar formato a los dictados (proveedor principal) |
| Groq, DeepInfra, OpenRouter | Estados Unidos | Lo mismo, solo si el proveedor principal falla |
| Supabase | Brasil (servidores) | Base de datos de cuentas y servidor del servicio |
| Stripe | Estados Unidos | Procesar pagos |
| Resend | Estados Unidos | Enviar los correos de la cuenta |
| Vercel | Estados Unidos | Alojar el sitio web y medir sus visitas de forma agregada |
| GitHub | Estados Unidos | Distribuir los instaladores |
| Meta (WhatsApp) | Estados Unidos | Soporte, solo si usted nos escribe |

Esto implica una **transferencia internacional de datos** a Estados Unidos y Brasil, países que
cuentan con niveles adecuados de protección. **Al aceptar esta Política, usted autoriza expresamente
esa transferencia.**

## 6. Cuánto tiempo guardamos los datos

- Datos de la cuenta: mientras la cuenta exista. Si la elimina, se borran, salvo lo que la ley
  obligue a conservar (por ejemplo, registros contables).
- Métricas de uso: **24 meses**.
- Audio y texto de dictados: no se guardan.
- Computadores que no se conectan en 90 días: se liberan solos de la cuenta.

## 7. Sus derechos

Como titular de sus datos, usted puede:
- **Conocer, actualizar y rectificar** sus datos.
- **Pedir prueba** de la autorización que nos dio.
- **Ser informado** del uso que hemos dado a sus datos.
- **Revocar la autorización y pedir que se supriman** sus datos, cuando no exista un deber legal o
  contractual de conservarlos.
- **Acceder gratis** a sus datos.
- **Presentar quejas ante la Superintendencia de Industria y Comercio (SIC)**, después de haber
  hecho su consulta o reclamo ante nosotros.

Responder preguntas sobre datos sensibles es **opcional**: no está obligado a hacerlo.

## 8. Cómo ejercer sus derechos

El área responsable de atender sus solicitudes es **CloseLabs**, en contacto@closelabs.co. Escriba
indicando su nombre, el correo de su cuenta y lo que pide.

- **Consultas:** respondemos en máximo **10 días hábiles** (prorrogables 5 días hábiles más,
  avisándole el motivo).
- **Reclamos** (corrección, actualización, supresión o incumplimiento): respondemos en máximo
  **15 días hábiles** (prorrogables 8 días hábiles más, avisándole el motivo).

También puede eliminar su cuenta directamente desde "Mi cuenta" en la aplicación.

## 9. Seguridad

Aplicamos medidas razonables para proteger sus datos: comunicaciones cifradas, contraseñas
guardadas con cifrado, acceso restringido a la base de datos, y un registro técnico de la
aplicación que se limpia de cualquier texto de dictados antes de salir de su computador. Ningún
sistema es perfectamente seguro; si ocurre un incidente que afecte sus datos, le avisaremos y lo
reportaremos a la autoridad cuando corresponda.

## 10. Menores de edad

El servicio es para profesionales adultos. Los datos de pacientes menores de edad que aparezcan en
un dictado los trata el profesional como Responsable, con las garantías especiales que exige la ley.

## 11. Sitio web y cookies

closelabs.co **no usa cookies**. Para saber cuántas personas lo visitan y si carga rápido, usa
**Vercel Web Analytics y Speed Insights**, que miden las visitas de forma agregada (qué páginas se
ven, desde qué país, con qué tipo de dispositivo y navegador) **sin cookies y sin identificarle**.
No los usamos para hacer publicidad ni para crear perfiles. Si esto cambia, actualizaremos esta
Política.

## 12. Cambios a esta Política

Publicaremos cualquier cambio con su fecha. Si el cambio es importante, le avisaremos en la
aplicación o por correo antes de que entre en vigor y, cuando la ley lo exija, le pediremos de
nuevo su autorización.

## 13. Vigencia

Esta Política rige desde el 5 de octubre de 2026. Las bases de datos se conservarán mientras
CloseLabs preste el servicio y por el tiempo adicional que exija la ley.
```
