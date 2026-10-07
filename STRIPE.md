# STRIPE — el cobro de CloseLabs Voice

> Cómo está conectado el cobro, cómo se prueba y qué falta para cobrar de verdad.
> **Última actualización: 2026-10-06.** Estado: servidor listo, en **modo de prueba**.

## Lo decidido (ver ROADMAP, Fase 2)

- **US$12 al mes**, en dólares, **igual en todos los canales** (desde 2026-10-06; antes US$11):
  comprar directo no puede salir más barato que comprar por gMedic. Cuenta de **CLOSELABS LLC**.
- La prueba de 30 días arranca **sin tarjeta**. La tarjeta se pone al final, desde "Mi cuenta".
- Quien pone la tarjeta en plena prueba **no pierde días**: el primer cobro llega el día que la
  prueba iba a terminar. Si le quedan menos de 48 h, Stripe no acepta esa fecha y se le corre a
  48 h: como mucho, dos días de regalo.
- El pago, la tarjeta, las facturas y la cancelación ocurren en **páginas de Stripe** (Checkout y
  portal), en el navegador. La tarjeta nunca pasa por la app ni por nuestro servidor.
- Cancelar es **al final del período**, con la pregunta opcional "¿por qué cancelas?" del portal.
  Se puede reanudar hasta esa fecha. Al cancelar mandamos **nuestro** correo (Stripe no lo manda).

## Cómo está armado

| Pieza | Qué hace |
|---|---|
| `supabase/functions/_shared/cobro.ts` | Toda la lógica: llamar a Stripe, verificar la firma del webhook, traducir el estado, el correo de cancelación |
| `account` (acciones `checkout`, `portal`, `resume`, `sync`) | Lo que pide "Mi cuenta". `checkout`/`portal` devuelven una URL para abrir en el navegador |
| `stripe-webhook` | Recibe los avisos de Stripe (`verify_jwt = false`; se autentica con la firma) |
| `subscriptions` | Una fila por médico, creada al registrarse. El webhook la mantiene al día |
| `stripe_eventos` | Bitácora de cada aviso recibido y qué se hizo. Para soporte |
| closelabs.co `/voice/pago-listo`, `/pago-cancelado`, `/cuenta-actualizada` | A donde Stripe devuelve al médico |
| App: `src/components/settings/account/Suscripcion.tsx` | El panel de "Mi cuenta": un estado y el botón que le toca. Al volver del navegador se pone al día solo (`sync` al recuperar el foco) |
| App: `auth.rs` → `account_open_billing`, `account_billing_refresh` | Abren la página de Stripe en el navegador (solo `checkout.stripe.com` / `billing.stripe.com`) y reanudan o ponen al día |
| `uso_de_la_cuenta()` | Dictados y minutos de voz para la pantalla de "gracias por probar" (solo contadores) |

**Lo que ve el médico en "Mi cuenta"** (`situacion()` en `Suscripcion.tsx`):

| Situación | Qué ve | Botón |
|---|---|---|
| En prueba, sin tarjeta | Días que le quedan | "Suscribirme · US$12 al mes" (destacado solo en los últimos 5 días) |
| En prueba, con tarjeta | Fecha del primer cobro | Administrar pago · Cancelar suscripción |
| Activa | Fecha de renovación | Administrar pago · Cancelar suscripción |
| Canceló, le queda período | "Puedes seguir dictando hasta el…" | **Reanudar suscripción** · Administrar pago |
| Cobro rechazado (reintentando) | "Sigues dictando con normalidad" | Actualizar tarjeta |
| Fin de la prueba sin pagar | **"Tu prueba gratuita terminó"**, el precio y, al final, sus dictados y horas de voz | Suscribirme |
| Suscripción terminada | Lo mismo, "Tu suscripción terminó" | Volver a suscribirme |
| Reintentos agotados | "Pausamos el dictado…" | Actualizar tarjeta |

Al terminar la prueba, un dictado negado ya NO muestra un aviso rojo: sale un **pop-up**
(`FinDePruebaModal.tsx`) con el mismo contenido y "Ahora no", sobre "Mi cuenta". La primera versión
("Gracias por probar" con los números en grande y el botón "Seguir dictando") no se entendía:
Nicolás la probó y parecía un fallo. Orden actual: qué pasó → qué hacer → precio → botón → datos.

**La regla que hace confiable el webhook:** nunca se escribe lo que trae el aviso; se le pregunta a
Stripe cómo está la suscripción ahora y se escribe eso. Los avisos llegan repetidos, tarde y en
desorden, y con esta regla da igual.

**Nadie paga dos veces:** si el médico ya tiene una suscripción viva (o con el cobro rechazado),
"Suscribirme" lo lleva al portal, no a un pago nuevo.

**Quien dicta lo decide `authorize_device_v2`, no Stripe:** la fecha manda sobre el estado (ver
migración 20260920000006). Lo único que hace el webhook es tener las fechas al día.

## Médicos de un socio (gMedic): sin Stripe, sin prueba

Desde 2026-10-06 (migración `20261006000003_canal_socios.sql`). Cada suscripción tiene un **canal**:
`directo` (todo lo de este documento) o `gmedic`. Al médico de gMedic le cobra gMedic: entra
**activo y sin prueba**, "Mi cuenta" dice "Tu suscripción la maneja gMedic" sin ningún botón de
pago, y el servidor rechaza pago, portal y reanudar (`canal_socio`). Dicta mientras su interruptor
(`status`) esté en `active`; las fechas no cuentan. Un aviso de Stripe no lo toca.

**Manual primero** (decisión de Nicolás): gMedic nos manda altas y bajas y nosotros las aplicamos
en **closelabs.co/voice/admin** (desde 2026-10-07): se entra con la cuenta de Voice si el correo
está en la tabla `administradores` (hoy: nicolas@closelabs.co; para sumar a alguien,
`insert into administradores (email) values ('…');`). Ahí se pegan correos para dar de alta o
pausar, y está la facturación por mes (activos en el mes, dictados, historial de altas y bajas de
cada médico, descarga para Excel). Cada alta y baja queda en `socio_cambios` con quién la hizo.

Lo mismo desde el SQL editor de Supabase:

```sql
select socio_autorizar('medica@clinica.com');   -- alta: si ya tiene cuenta, la pasa a gMedic y la activa;
                                               -- si no, entra activa (sin prueba) cuando se registre
select socio_pausar('medica@clinica.com');      -- baja: deja de dictar desde ya
select * from socio_uso_mes('2026-10-01');      -- médicos de gMedic y su uso en ese mes (para facturar)
```

Si estaba pausado y gMedic lo reactiva: `socio_autorizar` otra vez. Si alguien que pagaba directo
pasa a gMedic, `socio_autorizar` lo avisa: hay que cancelar a mano su suscripción en Stripe para que
no pague dos veces.

## Secretos (Supabase → Edge Functions → Secrets)

| Secreto | Qué es |
|---|---|
| `STRIPE_SECRET_KEY` | Llave **restringida** (`rk_…`): Customers W, Checkout Sessions W, Customer Portal W, Subscriptions W, Prices R, Products R. Nada más |
| `STRIPE_WEBHOOK_SECRET` | Signing secret del endpoint (`whsec_…`) |
| `STRIPE_PRICE_ID` | El precio de US$12 mensual (`price_…`) |
| `RESEND_API_KEY` | Ya existía; manda el correo de cancelación desde `cuenta@closelabs.co` |

⚠️ **Los tres de Stripe se cambian JUNTOS** al pasar a pagos reales. Una llave de prueba con un
precio real (o al revés) falla en cada pago.

## Configuración en el dashboard de Stripe

- **Webhook:** `https://gdizmbuzepxnkiahbeoz.supabase.co/functions/v1/stripe-webhook`, con los
  eventos `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e
  `invoice.payment_failed`.
- **Customer portal:** actualizar tarjeta y ver facturas: sí. Cancelar: al final del período, con
  "Collect cancellation reason". Cambiar de plan o cantidad: no. Enlaces a /terminos y /privacidad.
  Redirect: `https://www.closelabs.co/voice/cuenta-actualizada`.

## Probar (modo de prueba)

Tarjetas de prueba de Stripe (cualquier fecha futura y cualquier CVC):

| Tarjeta | Qué pasa |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 0341` | Se guarda, pero el cobro se rechaza (para probar `past_due`) |
| `4000 0025 0000 3155` | Pide verificación 3D Secure |

Casos a recorrer: suscribirse en plena prueba (primer cobro al final), suscribirse con la prueba
vencida (cobro inmediato), cancelar (correo + sigue dictando), reanudar, tarjeta rechazada.
Para ver el paso del tiempo sin esperar 30 días: **Test clocks** en el dashboard de Stripe.

Para revisar: `select * from stripe_eventos order by recibido_at desc;` y la fila del médico en
`subscriptions`. Pruebas automáticas: `bun supabase/functions/_tests/cobro.test.ts`.

### Probado de punta a punta (2026-10-06, modo de prueba)

| Caso | Resultado |
|---|---|
| Pagar en plena prueba | ✅ Tarjeta guardada, sin cobro; primer cobro el día que terminaba la prueba |
| Pagar con la prueba vencida | ✅ US$11 (el precio de entonces) al momento, activa por un mes |
| "Suscribirme" estando suscrito | ✅ Lleva al portal, nunca a un segundo pago |
| Cancelar en el portal (con motivo) | ✅ Sigue dictando hasta el fin del período; **un** correo |
| Reanudar | ✅ La app recibe el estado al instante |

⚠️ **Lo que encontró la prueba real:** al cancelar, Stripe manda dos avisos casi juntos (la
cancelación y el motivo) y llegaban **dos correos**. Se arregló haciendo que la base decida la
transición con una escritura condicional (ver `sincronizar`); hay una prueba con los dos avisos en
paralelo.

Cuentas de prueba en producción (datos inventados, `nicolas+prueba-stripe@` y
`nicolas+prueba-stripe2@closelabs.co`): se usan para probar las pantallas de la app y se borran
antes de pasar a pagos reales.

## Para cobrar de verdad (cuando la LLC tenga EIN)

1. Activar la cuenta de Stripe (datos de la LLC, EIN, cuenta bancaria, descriptor `CLOSELABS`).
2. Crear en modo real el mismo producto/precio, la llave restringida, el webhook y el portal.
3. Cambiar los tres secretos juntos.
4. Activar en Stripe los correos de recibo y de cobro fallido (en modo de prueba no se mandan).
5. Borrar las dos cuentas de prueba (Supabase → Authentication).
6. Retracto (5 días hábiles, Ley 1480): el reembolso se hace a mano desde el dashboard; la
   cancelación inmediata corta el dictado en ese momento (`ended_at`, ver `estadoDesdeStripe`).
