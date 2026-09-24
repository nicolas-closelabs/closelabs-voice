# Banco de pruebas del dictado

Un conjunto FIJO de dictados con sus comprobaciones, para saber con números si un cambio mejora o
empeora la limpieza del texto. Existe porque hasta ahora cada decisión se defendía con una
anécdota ("lo probé y salió bien"), y así no se puede sostener un producto clínico.

**Regla de uso:** ningún cambio en `_shared/format.ts`, en el prompt de `settings.rs` ni en la
tabla `providers` se da por bueno sin pasar el banco antes y después, y comparar.

## Correr

```bash
bun pruebas-dictado/correr.ts                 # todo el banco, 3 repeticiones por caso
bun pruebas-dictado/correr.ts --repeticiones 1
bun pruebas-dictado/correr.ts --caso largo-3min
bun pruebas-dictado/correr.ts --etiqueta "openrouter-gpt-oss"   # nombre del resultado guardado
bun pruebas-dictado/correr.ts --proveedor openai-luna           # solo cuenta lo que sirvió ESE proveedor
```

⚠️ **Al medir un proveedor nuevo, usar siempre `--proveedor`.** Si el principal falla, el respaldo
contesta y el banco lo califica como si fuera el principal. Pasó el 2026-09-24: gpt-6-luna recibió
429 en la mitad de las llamadas y el banco dio 41/42 con la mitad de las respuestas de gpt-4o-mini.
Con `--proveedor`, lo que sirvió otro se cuenta aparte y queda fuera de la nota.

Cada corrida guarda un JSON en `resultados/` y, si encuentra la anterior, imprime la comparación.

Usa el token de este equipo (`settings_store.json`) para hablar con `/format`, así que mide **lo
que hay desplegado en ese momento**: proveedor, modelo, prompt y troceado. Para comparar dos
opciones, se cambia la configuración, se corre el banco y se comparan las dos etiquetas.

## Por qué mide `/format` y no un modelo directo

Porque lo que le importa al médico no es el modelo: es lo que sale por el otro lado, con el
respaldo, el troceado y las guardas puestas. Medir el modelo suelto esconde justo los fallos que
aparecen en producción.

## Qué comprueba cada caso

Cosas objetivas, nunca "se ve bien":

| Comprobación | Qué exige |
|---|---|
| `numeros_intactos` | Todo número de la entrada sigue en la salida (salvo los que se declaren retractados), y no aparecen números nuevos |
| `conserva` | Los términos clínicos listados siguen ahí (medicamentos, servicios, apellidos) |
| `contiene` / `no_contiene` | Texto que debe o no debe aparecer |
| `termina_en` | La última idea del dictado llegó: detecta el texto que se corta a mitad |
| `sin_muletillas` | No quedan "eh", "em", "este" sueltos |
| `formato_basico` | Empieza en mayúscula y termina en signo |
| `longitud` | La salida no se desvía de la entrada más de lo declarado: detecta resúmenes y repeticiones |

⚠️ **Las comprobaciones no premian que el texto sea bonito.** Premian que no se pierda ni cambie
contenido, que es el requisito que de verdad manda.

## Repeticiones: 3 por caso, y es a propósito

Los fallos de estos modelos son **intermitentes**: el mismo dictado sale bien dos veces y mal la
tercera. Un banco que corre una sola vez cada caso da una falsa sensación de solidez. Por eso el
resultado de cada comprobación es "3 de 3" o "2 de 3", y un "2 de 3" es un fallo.

## Añadir casos

Los casos son la parte valiosa del banco; el código es lo de menos. Van en `casos/*.json`, con el
texto **CRUDO** (lo que devuelve el motor de voz, antes de limpiar), no el texto ya limpio.

Para capturar un crudo de verdad:

1. Apagar la limpieza un momento: en `app_config`, poner `format_provider` en un valor que no
   exista (por ejemplo `'apagado'`) y vaciar `format_fallbacks`. La app pega el texto crudo.
2. Dictar el caso y pegar lo que salga en un archivo nuevo de `casos/`.
3. Restaurar `app_config` (⚠️ no olvidarlo: mientras tanto NADIE recibe texto limpio).

Nunca se usan dictados de pacientes reales: los casos son inventados, aunque hablen como un médico.

## Prueba ácida: gpt-4o-mini contra gpt-6-luna (PENDIENTE — después de grabar el guion)

**Por qué:** en el único defecto abierto (el dictado de 6 min que deja las dos dosis de una
corrección), luna salió limpio 21 de 21 y gpt-4o-mini falló 2 de 21. Puede ser suerte (~11%).
Luna es 6% más barato y tarda el doble; solo vale la pena si de verdad cambia menos contenido.
Detalle en `BACKLOG.md` (2026-09-24, gpt-6-luna).

**Cuándo:** después de grabar `GUION-GRABACIONES.md` y convertir los crudos en casos, para que la
prueba cubra las ocho especialidades y no solo los 9 casos de hoy.

**Regla de decisión — fijada el 2026-09-24, ANTES de ver los números. No se cambia después.**

Se mira `CONTENIDO: X de N respuestas cambiaron o perdieron contenido`, que cuenta cualquier
número perdido o de más, término perdido, retractación que sobrevive, texto que no llega al final o
salida resumida. Las muletillas y la mayúscula inicial NO cuentan: son forma, no contenido.

Luna reemplaza a gpt-4o-mini **solo si se cumplen las tres**:
1. **Menos fallos de contenido**: en el total del banco (10 repeticiones) más `largo-6min` (30),
   luna tiene **al menos 3 fallos menos** que gpt-4o-mini.
2. **No empeora nada**: ninguna comprobación de contenido que gpt-4o-mini saque perfecta sale
   imperfecta con luna.
3. **Tiempo aceptable**: mediana del dictado de 6 min por debajo de 10 s, y la peor respuesta de
   todo el banco por debajo de 20 s (la app pega el texto crudo a los 30 s).

Si falta cualquiera, o empatan: **se queda gpt-4o-mini** (más rápido) y el defecto de la dosis se
ataca por otro lado —prompt o troceado— medido con este mismo banco.

**Pasos:**
1. Con gpt-4o-mini de principal (como está):
   ```bash
   bun pruebas-dictado/correr.ts --proveedor openai --repeticiones 10 --etiqueta acida-4o-mini
   bun pruebas-dictado/correr.ts --proveedor openai --caso largo-6min --repeticiones 30 --etiqueta acida-4o-mini-6min
   ```
2. Migración que habilite `openai-luna` y la ponga de principal (con `openai` de primer respaldo),
   `db push`, esperar un minuto (caché del ruteo), y lo mismo con `--proveedor openai-luna`.
3. Migración con el ganador, `db push`, y el resultado en `BACKLOG.md`.
4. Ese mismo día, en el panel de uso de OpenAI: tokens de entrada CACHEADOS de cada modelo. La
   caché de luna cuesta $0,01 contra $0,075 por millón y nuestro prompt es ~86% del costo;
   `usage_events` no lo guarda. Cambia el costo, no la decisión: la regla de arriba es de calidad.

Costo de la prueba completa: menos de un dólar. Tiempo: ~30 minutos por modelo.
