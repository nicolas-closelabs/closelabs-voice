# Pendientes de la web y del dominio

> ⚠️ **2026-10-05: la web salió de Lovable.** Ahora vive en `nicolas-closelabs/closelabs` (clon en
> `../closelabs-web`), Vercel publica `main` directo a producción y closelabs.co redirige a
> www.closelabs.co. Los prompts de abajo ya NO hacen falta: lo implementó Claude Code y está en
> vivo (commit 04a6f63). Quedan como registro de lo que se pidió.
> Actualizado el 2026-10-05.
> Los textos legales (Términos y Privacidad) están en `legal/TERMINOS-Y-PRIVACIDAD-v1.md`
> (aprobados por el abogado el 2026-10-04): su Parte C es el prompt que se pega en Lovable.

| | Qué | Por qué | Estado |
|---|---|---|---|
| 1 | Pie con "© 2026 CLOSELABS LLC" + página /empresa | Apple y Microsoft verifican que la web sea de la empresa (firmas) | ✅ En vivo (2026-10-05) |
| 2 | Las 3 páginas de después del pago | Stripe necesita a dónde mandar al médico | ✅ En vivo (2026-10-05), fuera de Google |
| 2b | Páginas /terminos y /privacidad (v1) | Las enlaza la app al registrarse; las pide Stripe | ✅ En vivo (2026-10-05) |
| 3 | Dominio a nombre de la LLC en Namecheap | Microsoft acepta la factura del dominio como prueba (firmas) | Pendiente |
| — | Buzones `contacto@` y `nicolas@` | Verificaciones de Microsoft y contacto | ✅ Hechos (Private Email de Namecheap, 2026-10-05) |

---

## 1. Prompt de Lovable — la web a nombre de CLOSELABS LLC

La dirección ya está puesta; tiene que ser **la misma** que la del D-U-N-S, letra por letra.

```
Necesito que el sitio muestre claramente que pertenece a la empresa CLOSELABS LLC. No cambies el
diseño ni el contenido existente: solo agrega lo siguiente, con el mismo estilo visual del sitio.

1. Pie de página en TODAS las páginas (incluida /voice y cualquier página nueva):
   - Una línea legal: "© 2026 CLOSELABS LLC. Todos los derechos reservados."
   - El nombre debe ir exactamente así: CLOSELABS LLC (en mayúsculas, con "LLC").
   - Un enlace de contacto al correo contacto@closelabs.co
   - Enlaces a /terminos y /privacidad (déjalos visibles aunque esas páginas todavía no existan;
     si no existen, no crees contenido legal inventado).

2. Una página nueva en la ruta /empresa, enlazada desde el pie de página con el texto "Empresa":
   - Título: "CloseLabs"
   - Un párrafo corto: "CloseLabs es una empresa de tecnología que desarrolla herramientas de
     inteligencia artificial para clínicas y consultorios médicos en Latinoamérica, como CloseLabs
     Voice, una aplicación de dictado por voz para médicos."
   - Un bloque "Datos de la empresa" con:
     Razón social: CLOSELABS LLC
     Dirección: 7345 W Sand Lake Rd, Ste 210, Office 4824, Orlando, FL 32819, United States
     Correo: contacto@closelabs.co
     WhatsApp: +57 310 299 1182 (enlace a https://wa.me/573102991182)

Reglas: todo en español, sobrio, nada con aspecto de plantilla de IA (sin gradientes llamativos,
sin emojis, sin íconos genéricos). Debe verse bien en computador y en celular.
```

---

## 2. Prompt de Lovable — las páginas de después del pago

```
Crea tres páginas nuevas en el sitio, con el mismo estilo visual de la página /voice que ya
existe (mismos colores, tipografías, logo y pie de página). Son páginas de paso: el médico llega
aquí desde la página de pago de Stripe y lo único que tiene que entender es que ya puede volver a
la app de escritorio CloseLabs Voice. Deben ser muy simples, centradas, sin menú de navegación
complicado, y verse bien en computador y en celular.

Reglas para las tres:
- Todo el texto en español, tuteando, frases cortas. El público son médicos de 40-60 años.
- Nada con aspecto de plantilla de IA: sin gradientes llamativos, sin emojis, sin íconos genéricos.
- No mostrar botones que intenten "abrir la app" automáticamente: solo decir que vuelva a ella.
- Incluir abajo un enlace discreto de ayuda por WhatsApp: https://wa.me/573102991182
  con el texto "¿Algo no salió bien? Escríbenos por WhatsApp".
- Marcar las tres con <meta name="robots" content="noindex"> (no deben aparecer en Google).

Página 1 — ruta /voice/pago-listo
- Título: "¡Listo! Tu suscripción está activa"
- Texto: "Ya puedes volver a CloseLabs Voice y seguir dictando. Tu primer cobro de US$11 aparecerá
  en el extracto de tu tarjeta. Puedes cancelar cuando quieras desde Mi cuenta, en la app."
- Un ícono o ilustración sobria de confirmación (un check), en el color de acento de la marca.

Página 2 — ruta /voice/pago-cancelado
- Título: "No se hizo ningún cobro"
- Texto: "Saliste antes de terminar el pago, así que no se cobró nada. Cuando quieras, vuelve a
  CloseLabs Voice y entra a Mi cuenta para intentarlo de nuevo."

Página 3 — ruta /voice/cuenta-actualizada
- Título: "Tus cambios quedaron guardados"
- Texto: "Ya puedes cerrar esta pestaña y volver a CloseLabs Voice."
```

---

## 3. Namecheap — el dominio a nombre de la LLC

1. Entrar a Namecheap → **Domain List** (menú izquierdo) → botón **Manage** junto a `closelabs.co`.
2. Bajar hasta la sección de **contactos del dominio** y editar el **Registrant**:
   - **Organization:** `CLOSELABS LLC`
   - **Nombre:** Nicolás, como representante.
   - **Dirección:** 7345 W Sand Lake Rd, Ste 210, Office 4824, Orlando, FL 32819, United States (la misma del D-U-N-S).
   - **Correo:** dejar el Gmail personal, **no** uno `@closelabs.co`: si algún día el dominio
     falla, los avisos de renovación tienen que llegar igual.
3. Marcar que los mismos datos se usen para **Administrative, Technical y Billing**, y guardar.
4. Namecheap manda un correo de confirmación al titular anterior y al nuevo, pero **lo aprueba
   solo**, y este cambio **no bloquea** el dominio 60 días.
5. **Dejar activada la privacidad del dominio**: Microsoft no mira el registro público, pide
   documentos.
6. En **Account → Profile**, poner los datos de facturación a nombre de **CLOSELABS LLC**, para que
   la próxima factura de renovación salga a nombre de la empresa (Microsoft acepta "la factura del
   dominio" como prueba).

⚠️ **No tocar los registros DNS.** Verificado el 2026-10-05: el correo de Private Email (MX y SPF
del dominio principal) y los correos de cuenta de la app (Resend, en el subdominio `send.` y la
firma `resend._domainkey`) conviven sin chocar. Si alguna vez hay que cambiar algo ahí, revisarlo
antes: si se rompe lo de Resend, los médicos dejan de recibir la confirmación de registro.

Nota menor: el DMARC manda reportes a `dmarc@closelabs.co`. Si ese buzón no existe, los reportes se
pierden; no afecta la entrega de correos.

Fuentes: [Namecheap — cambio de titular sin bloqueo](https://www.namecheap.com/support/knowledgebase/article.aspx/9819/2209/new-icanns-interregistrar-transfer-policy/) ·
[Namecheap — contactos con privacidad activada](https://www.namecheap.com/support/knowledgebase/article.aspx/491/37/can-i-change-contact-information-for-my-domain-with-domain-privacy-enabled/)
