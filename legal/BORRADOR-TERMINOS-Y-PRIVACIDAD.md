# Borrador: Términos y Condiciones y Política de Tratamiento de Datos — CloseLabs Voice

> **Para el abogado.** Borrador de partida escrito el 2026-10-05 a partir de cómo funciona hoy el
> producto (verificado en el código). **No es asesoría legal.** Está pensado para que se revise y
> se ajuste, no para publicarlo tal cual. Lo marcado **[PENDIENTE]** son datos que faltan, y las
> **preguntas abiertas** de abajo son los puntos donde la decisión es jurídica.
>
> **Cómo se usa:** 1) el abogado revisa este archivo; 2) con el texto aprobado, se pega el prompt
> de la Parte C en Lovable para crear las páginas `/terminos` y `/privacidad`. **No publicar las
> páginas antes de la aprobación.**

---

## Parte A — Lo que hay que saber del producto (hechos, no opiniones)

- **Empresa:** CLOSELABS LLC, sociedad de responsabilidad limitada de EE.UU. con **dos socios**
  (uno colombiano y uno español), en constitución a octubre de 2026. Dirección **[PENDIENTE]**.
- **Producto:** aplicación de escritorio (Windows y macOS) de **dictado por voz para médicos**. El
  médico presiona un atajo, habla, y el texto transcrito y puntuado se pega en el programa que
  tenga abierto (por ejemplo, su software de historia clínica).
- **Usuarios:** médicos, principalmente en Colombia; después México y Perú.
- **Precio:** prueba gratis de 30 días **sin tarjeta**; luego **US$11 al mes**, cobrados en dólares
  por **Stripe**, con renovación mensual automática. Hasta 3 computadores por cuenta.
- **Cancelación (decidido):** en cualquier momento, desde la app, en dos clics, sin trampas. El
  médico sigue usando el servicio **hasta el final del período pagado**. **No se devuelve** la parte
  no usada del mes.
- **Canal de aliados:** algunos médicos pueden llegar a través de un aliado (p. ej. un software de
  historia clínica) que factura y gestiona el cobro por su cuenta.

**Qué datos se tratan, y dónde (verificado en el código):**

| Dato | Para qué | Dónde queda |
|---|---|---|
| Nombre, correo, teléfono (con indicativo), contraseña (cifrada), fecha y versión de aceptación de estos textos | Crear y administrar la cuenta, contactar al médico | Supabase (servidores en São Paulo, Brasil) |
| Identificador del computador, nombre del computador (p. ej. "MacBook de Ana"), sistema operativo, versión de la app, última conexión | Limitar a 3 computadores, seguridad | Supabase |
| **Métricas de uso**: fecha y hora de cada dictado, segundos de audio, cantidad de texto, proveedor que lo atendió, tiempo de respuesta, códigos de error. **Nunca el contenido** | Cupos, facturación, detectar fallas | Supabase |
| **Audio y texto de cada dictado** (pueden contener datos de salud de pacientes) | Transcribir y dar formato | **No se guardan.** Viajan al servidor de CloseLabs y de ahí al proveedor de IA, que devuelve el texto. Ver "Proveedores" |
| Diccionario personal (palabras que el médico agrega) | Que la transcripción escriba bien sus términos | Solo en el computador del médico; viaja como "pista" con cada dictado |
| Reporte de problema (voluntario) | Soporte | Se envía el registro técnico de la app **limpiado de texto de dictados** |
| Estado de la suscripción | Saber si puede dictar | Supabase. **Los datos de la tarjeta los maneja Stripe**; CloseLabs no los ve |
| Conversaciones de soporte | Soporte | WhatsApp (Meta), solo si el médico escribe |

**Sin internet**, la app transcribe con un modelo **dentro del computador**: el audio no sale.

**Proveedores que procesan datos (encargados/subencargados):**

| Proveedor | País | Qué procesa |
|---|---|---|
| OpenAI | EE.UU. | Audio y texto de dictados (transcripción y formato). **Principal** |
| Groq, DeepInfra, OpenRouter | EE.UU. | Audio o texto de dictados, **solo si OpenAI falla** (respaldo automático) |
| Supabase | Brasil (servidores) / EE.UU. (empresa) | Cuentas, equipos, métricas; el servidor por donde pasan los dictados |
| Stripe | EE.UU. | Pagos |
| Resend | EE.UU. | Correos de la cuenta |
| Vercel | EE.UU. | Sitio web |
| GitHub | EE.UU. | Descarga de los instaladores |

**Sobre "no se guardan":** CloseLabs no guarda el audio ni el texto. Pero **los proveedores de IA
pueden retenerlos temporalmente según sus propias políticas** (OpenAI, por ejemplo, conserva los
datos de su API hasta 30 días para vigilar abusos, salvo acuerdo de retención cero) y, según sus
condiciones para clientes de API, **no los usan para entrenar modelos**. El texto de abajo lo dice
así; hay que verificar las condiciones vigentes de cada proveedor.

---

## Parte B — Preguntas abiertas para el abogado

1. **Roles (Ley 1581).** El borrador asume que, respecto de **los datos de los pacientes**, el
   **médico o su institución es el Responsable** y CloseLabs es **Encargado**; y que, respecto de
   **los datos de la cuenta del médico**, CloseLabs es Responsable. ¿Es correcto? ¿Hace falta un
   **contrato de transmisión de datos** (Decreto 1377 de 2013, hoy en el Decreto 1074 de 2015)? El
   borrador lo incluye como cláusula de los Términos; ¿basta, o va como documento aparte?
2. **Datos sensibles.** Los dictados pueden contener datos de salud. ¿Qué obligaciones adicionales
   tiene CloseLabs como Encargado? ¿Y la **voz** del médico cuenta como dato biométrico si no se
   usa para identificarlo?
3. **Transferencia internacional.** Los datos van a EE.UU. y a Brasil. ¿Cómo se ampara: país con
   nivel adecuado según la SIC, autorización expresa, o el contrato de transmisión?
4. **Derecho de retracto (Ley 1480, art. 47).** La decisión de negocio es **no reembolsar**. ¿Aplica
   el retracto de 5 días hábiles al primer cobro después de la prueba gratis? Si aplica, hay que
   decirlo y honrarlo.
5. **Ley aplicable y jurisdicción.** Empresa en EE.UU., usuarios en Colombia (consumidores, con
   normas que no se pueden renunciar). ¿Qué cláusula dejar?
6. **Registro Nacional de Bases de Datos (SIC).** ¿Le aplica a una LLC extranjera?
7. **Responsabilidad clínica.** ¿Basta la cláusula de "herramienta de apoyo; el médico revisa antes
   de firmar"? ¿Riesgo de que se considere dispositivo médico (INVIMA)? El producto no diagnostica
   ni recomienda: solo transcribe y puntúa.
8. **Aceptaciones ya dadas.** Los médicos que se registraron hasta hoy marcaron "Acepto los Términos
   y la Política" con enlaces que todavía no existían (versión registrada: "v1"). ¿Hay que pedirles
   aceptar de nuevo cuando se publiquen?
9. **México y Perú.** ¿Qué cambia al abrir esos países (LFPDPPP en México, Ley 29733 en Perú)?
10. **Limitación de responsabilidad.** ¿Qué tope es válido frente al Estatuto del Consumidor?

---

## Parte C — Prompt para Lovable (usar SOLO con el texto ya aprobado)

> Copiar desde la línea "Crea dos páginas" hasta el final, después de reemplazar los [PENDIENTE].

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

Versión 1 · Vigentes desde el [PENDIENTE: fecha de publicación]

## 1. Quiénes somos

CloseLabs Voice es un servicio de CLOSELABS LLC, sociedad constituida en [PENDIENTE: estado] de
los Estados Unidos de América, con domicilio en [PENDIENTE: dirección] ("CloseLabs", "nosotros").
Correo de contacto: contacto@closelabs.co · WhatsApp: +57 310 299 1182.

Al crear una cuenta o usar CloseLabs Voice, usted ("el Usuario") acepta estos Términos y la
Política de Tratamiento de Datos Personales (/privacidad). Si no está de acuerdo, no use el
servicio.

## 2. Qué es el servicio

CloseLabs Voice es una aplicación de escritorio para Windows y macOS que convierte la voz del
Usuario en texto y lo pega en el programa que tenga abierto. Con conexión a internet, el audio se
envía a los servidores de CloseLabs y a proveedores de inteligencia artificial que lo transcriben y
le dan formato (puntuación, mayúsculas, eliminación de muletillas y aplicación de las correcciones
habladas, como "mentira" o "me equivoqué"). Sin conexión, la transcripción se hace dentro del
computador, con menor calidad.

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
- El Usuario debe tener capacidad legal para contratar.

## 5. Prueba gratis, precio y pago

- **Prueba gratis:** 30 días desde el registro, sin necesidad de tarjeta.
- **Precio:** US$11 (once dólares de los Estados Unidos) al mes, [PENDIENTE: "impuestos incluidos" /
  "más los impuestos que apliquen"].
- **Cómo se paga:** con tarjeta, a través de Stripe, nuestro procesador de pagos. CloseLabs no ve
  ni guarda los datos de la tarjeta.
- **Renovación automática:** la suscripción se renueva y se cobra cada mes hasta que el Usuario la
  cancele.
- **Pago rechazado:** si un cobro no pasa, el procesador lo reintenta durante algunos días; mientras
  tanto el servicio sigue funcionando y avisamos al Usuario para que actualice su tarjeta. Si los
  reintentos fallan, el servicio se suspende hasta que se complete el pago.
- **Cambios de precio:** avisaremos con al menos 30 días de anticipación. El nuevo precio aplica
  desde el siguiente período, y el Usuario puede cancelar antes si no está de acuerdo.
- Su banco puede cobrar comisiones por compras internacionales o por conversión de moneda; esas
  comisiones no dependen de CloseLabs.

## 6. Cancelación

- El Usuario puede cancelar **en cualquier momento, desde "Mi cuenta" en la aplicación**, sin
  llamar ni escribir a nadie.
- Al cancelar, **el servicio sigue funcionando hasta el último día del período ya pagado**, y no
  se vuelve a cobrar. Hasta esa fecha el Usuario puede reanudar la suscripción.
- **No se hacen reembolsos por la parte no usada de un período**, porque el servicio sigue
  disponible hasta su final. [PENDIENTE abogado: derecho de retracto, Ley 1480 art. 47]
- Durante la prueba gratis no hay nada que cancelar: si al terminar no se agrega una tarjeta, la
  prueba simplemente termina.
- Cancelar no borra la cuenta. Para eliminar la cuenta y sus datos, ver la sección 9.

Si el Usuario accedió al servicio a través de un aliado comercial que gestiona su facturación, la
cancelación y los pagos se gestionan con ese aliado.

## 7. Uso permitido

El Usuario se compromete a no:
- Usar el servicio para fines ilegales o para tratar datos de personas sin la autorización que exija
  la ley.
- Intentar acceder a los sistemas de CloseLabs o de sus proveedores por medios no autorizados,
  copiar, descompilar o revender el servicio.
- Usar el servicio de forma automatizada o masiva que afecte su funcionamiento para otros usuarios.

Hay un límite diario de uso por computador, muy por encima de lo que dicta un profesional en una
jornada, que protege el servicio de abusos.

## 8. Datos de pacientes

Cuando el Usuario dicta información de sus pacientes, **el Usuario (o la institución para la que
trabaja) es el Responsable del tratamiento** de esos datos, y CloseLabs actúa como **Encargado**:
los trata solo para prestar el servicio y por cuenta del Usuario.

El Usuario declara que cuenta con la autorización de los pacientes y con las demás condiciones
legales para tratar sus datos, incluidos los datos de salud.

CloseLabs, como Encargado, se compromete a:
- Tratar el audio y el texto de los dictados **solo para transcribirlos y darles formato**.
- **No guardar** el audio ni el texto de los dictados en sus sistemas.
- No usarlos para entrenar modelos ni para ningún otro fin.
- Exigir a sus proveedores condiciones de confidencialidad y seguridad equivalentes.
- Aplicar medidas de seguridad razonables (comunicaciones cifradas, acceso restringido).
- Informar al Usuario, sin demora injustificada, de cualquier incidente de seguridad que afecte
  esos datos.

El detalle de los proveedores y de las transferencias internacionales está en la Política de
Tratamiento de Datos Personales. [PENDIENTE abogado: ¿contrato de transmisión aparte?]

## 9. Eliminar la cuenta

El Usuario puede eliminar su cuenta en cualquier momento desde "Mi cuenta". Al eliminarla se borran
su perfil, sus computadores registrados y el estado de su suscripción; si hay una suscripción
activa, se cancela primero. Algunos registros pueden conservarse el tiempo que exija la ley (por
ejemplo, contables).

## 10. Disponibilidad del servicio

Hacemos lo razonable para que el servicio funcione siempre, con proveedores de respaldo automático.
Pero depende de internet y de terceros, y **no garantizamos que funcione sin interrupciones ni
errores**. Sin conexión, la aplicación sigue transcribiendo dentro del computador, con menor calidad.

Podemos actualizar la aplicación, cambiar proveedores o mejorar funciones. Si un cambio afecta de
forma importante el servicio contratado, avisaremos con anticipación.

## 11. Propiedad intelectual

La aplicación, la marca CloseLabs y sus contenidos son de CloseLabs o de sus licenciantes. Le
otorgamos al Usuario una licencia personal, limitada, no exclusiva e intransferible para usar la
aplicación mientras su cuenta esté activa.

**El texto que el Usuario dicta es suyo.** CloseLabs no adquiere ningún derecho sobre él.

La aplicación incluye software de código abierto, en particular Handy (MIT License, © CJ Pais),
cuyas licencias se respetan y se pueden consultar en la aplicación.

## 12. Responsabilidad

[PENDIENTE abogado: redactar el tope de responsabilidad compatible con el Estatuto del Consumidor.]

CloseLabs no responde por:
- El contenido de los documentos que el Usuario firme o use sin revisar (ver sección 3).
- Daños causados por un uso contrario a estos Términos.
- Fallas de internet, del computador del Usuario o de servicios de terceros fuera de nuestro control.

Nada de lo anterior limita los derechos que la ley le reconoce al Usuario como consumidor.

## 13. Suspensión y terminación

Podemos suspender o cerrar una cuenta que incumpla estos Términos (por ejemplo, una cuenta
compartida o un uso abusivo), avisándole al Usuario y, cuando sea posible, dándole la oportunidad
de corregirlo.

## 14. Cambios a estos Términos

Si cambiamos estos Términos, publicaremos la nueva versión con su fecha y avisaremos al Usuario en
la aplicación o por correo antes de que entre en vigor. Si no está de acuerdo, puede cancelar.

## 15. Peticiones, quejas y reclamos

El Usuario puede escribirnos a contacto@closelabs.co o por WhatsApp al +57 310 299 1182.
Responderemos en un plazo máximo de [PENDIENTE: 15 días hábiles].

## 16. Ley aplicable

[PENDIENTE abogado: ley aplicable y jurisdicción. Nada de esto limita los derechos irrenunciables
del Usuario como consumidor en su país.]

========================================
PÁGINA 2 — ruta /privacidad
========================================

# Política de Tratamiento de Datos Personales de CloseLabs Voice

Versión 1 · Vigente desde el [PENDIENTE: fecha de publicación]

## 1. Responsable del tratamiento

CLOSELABS LLC
Domicilio: [PENDIENTE: dirección]
Correo: contacto@closelabs.co
WhatsApp: +57 310 299 1182

Esta Política se expide en cumplimiento de la Ley 1581 de 2012, el Decreto 1074 de 2015 (que
compila el Decreto 1377 de 2013) y demás normas colombianas de protección de datos personales.
[PENDIENTE abogado: normas de México y Perú cuando se abran esos países.]

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
| Nombre, correo, teléfono con indicativo, contraseña (guardada cifrada) | Crear y administrar su cuenta, comunicarnos con usted, darle soporte |
| Fecha y versión en que aceptó estos textos | Demostrar su autorización |
| Identificador y nombre de sus computadores, sistema operativo, versión de la aplicación, última conexión | Permitir hasta tres computadores por cuenta y proteger la cuenta |
| Métricas de uso: fecha y hora de cada dictado, duración del audio, cantidad de texto, tiempo de respuesta, errores. **Sin el contenido** | Aplicar los límites de uso, facturar, detectar y corregir fallas, mejorar el servicio |
| Estado de su suscripción | Saber si el servicio está activo. **Los datos de su tarjeta los trata Stripe**; nosotros no los vemos |
| Audio y texto de los dictados | Únicamente transcribir y dar formato. **No se guardan** (ver sección 4) |
| Diccionario personal | Mejorar la escritura de sus términos. Se guarda solo en su computador |
| Registro técnico de la aplicación, si usted reporta un problema | Soporte. Se envía limpio de texto de dictados y solo si usted lo decide |

**Comunicaciones:** usaremos su correo y teléfono para temas de su cuenta y del servicio.
[PENDIENTE abogado: el teléfono se pidió también "como base de contactos para otros productos de
CloseLabs"; si se usará para ofrecer otros productos, debe ser una autorización separada y
opcional.]

## 4. Los dictados y los datos de sus pacientes

Sus dictados pueden contener datos de salud de sus pacientes, que la ley considera **datos
sensibles**. Sobre esos datos:

- **Usted (o su institución) es el Responsable** del tratamiento, y CloseLabs actúa como
  **Encargado**: los trata por cuenta suya y solo para prestarle el servicio.
- Usted debe contar con la autorización de sus pacientes y cumplir las normas de historia clínica.
- **CloseLabs no guarda el audio ni el texto.** Viajan cifrados a nuestro servidor, de ahí al
  proveedor de inteligencia artificial que los procesa, y el texto vuelve a su computador.
- Nuestros proveedores de inteligencia artificial **no usan esos datos para entrenar modelos**,
  según sus condiciones para clientes empresariales, pero **pueden conservarlos por un tiempo
  limitado** para seguridad y prevención de abusos (por ejemplo, OpenAI hasta 30 días), según sus
  propias políticas. [PENDIENTE: verificar condiciones vigentes de cada proveedor.]
- **Sin conexión a internet**, la transcripción se hace dentro de su computador y el audio no sale.

## 5. Con quién compartimos datos (encargados) y transferencias internacionales

No vendemos ni alquilamos datos personales. Los compartimos solo con estos proveedores, que los
tratan por cuenta nuestra y bajo obligaciones de confidencialidad:

| Proveedor | País | Para qué |
|---|---|---|
| OpenAI | Estados Unidos | Transcribir y dar formato a los dictados (proveedor principal) |
| Groq, DeepInfra, OpenRouter | Estados Unidos | Lo mismo, solo si el proveedor principal falla |
| Supabase | Brasil (servidores) | Base de datos de cuentas y servidor del servicio |
| Stripe | Estados Unidos | Procesar pagos |
| Resend | Estados Unidos | Enviar los correos de la cuenta |
| Vercel | Estados Unidos | Alojar el sitio web |
| GitHub | Estados Unidos | Distribuir los instaladores |
| Meta (WhatsApp) | Estados Unidos | Soporte, solo si usted nos escribe |

Esto implica una **transferencia internacional de datos** a Estados Unidos y Brasil.
[PENDIENTE abogado: fundamento de la transferencia — nivel adecuado según la SIC, autorización
expresa o contrato.] Al aceptar esta Política, usted autoriza esa transferencia.

## 6. Cuánto tiempo guardamos los datos

- Datos de la cuenta: mientras la cuenta exista. Si la elimina, se borran, salvo lo que la ley
  obligue a conservar (por ejemplo, registros contables).
- Métricas de uso: [PENDIENTE: plazo, p. ej. 24 meses].
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

Darnos datos sensibles es **opcional**: no está obligado a hacerlo.

## 8. Cómo ejercer sus derechos

Escríbanos a contacto@closelabs.co indicando su nombre, el correo de su cuenta y lo que pide.
[PENDIENTE: persona o área responsable de atender estas solicitudes.]

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

[PENDIENTE: describir si closelabs.co usa cookies o herramientas de analítica.]

## 12. Cambios a esta Política

Publicaremos cualquier cambio con su fecha. Si el cambio es importante, le avisaremos en la
aplicación o por correo antes de que entre en vigor y, cuando la ley lo exija, le pediremos de
nuevo su autorización.

## 13. Vigencia

Esta Política rige desde el [PENDIENTE: fecha]. Las bases de datos se conservarán mientras
CloseLabs preste el servicio y por el tiempo adicional que exija la ley.
```
