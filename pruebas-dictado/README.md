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
```

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
