# STRIPE — el cobro de CloseLabs Voice

> Cómo está conectado el cobro, cómo se prueba y qué falta para cobrar de verdad.
> **Última actualización: 2026-10-06.** Estado: servidor listo, en **modo de prueba**.

## Lo decidido (ver ROADMAP, Fase 2)

- **US$11 al mes**, en dólares. Cuenta de Stripe de **CLOSELABS LLC**.
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

**La regla que hace confiable el webhook:** nunca se escribe lo que trae el aviso; se le pregunta a
Stripe cómo está la suscripción ahora y se escribe eso. Los avisos llegan repetidos, tarde y en
desorden, y con esta regla da igual.

**Nadie paga dos veces:** si el médico ya tiene una suscripción viva (o con el cobro rechazado),
"Suscribirme" lo lleva al portal, no a un pago nuevo.

**Quien dicta lo decide `authorize_device_v2`, no Stripe:** la fecha manda sobre el estado (ver
migración 20260920000006). Lo único que hace el webhook es tener las fechas al día.

## Secretos (Supabase → Edge Functions → Secrets)

| Secreto | Qué es |
|---|---|
| `STRIPE_SECRET_KEY` | Llave **restringida** (`rk_…`): Customers W, Checkout Sessions W, Customer Portal W, Subscriptions W, Prices R, Products R. Nada más |
| `STRIPE_WEBHOOK_SECRET` | Signing secret del endpoint (`whsec_…`) |
| `STRIPE_PRICE_ID` | El precio de US$11 mensual (`price_…`) |
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

## Para cobrar de verdad (cuando la LLC tenga EIN)

1. Activar la cuenta de Stripe (datos de la LLC, EIN, cuenta bancaria, descriptor `CLOSELABS`).
2. Crear en modo real el mismo producto/precio, la llave restringida, el webhook y el portal.
3. Cambiar los tres secretos juntos.
4. Activar en Stripe los correos de recibo y de cobro fallido (en modo de prueba no se mandan).
5. Retracto (5 días hábiles, Ley 1480): el reembolso se hace a mano desde el dashboard; la
   cancelación inmediata corta el dictado en ese momento (`ended_at`, ver `estadoDesdeStripe`).
