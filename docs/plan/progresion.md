# Algoritmo de progresión — subir / mantener / bajar (O1)

> Especificación testeable del algoritmo que sugiere la carga de cada ejercicio.
> Implementado en [`docs/js/progresion.js`](../js/progresion.js) y verificado por
> [`docs/tests/progresion.test.mjs`](../tests/progresion.test.mjs)
> (ejecutar: `node docs/tests/progresion.test.mjs`).
>
> Filosofía (fase 1, `instrucciones.md`): **progresión autorregulada por RIR**, conservadora.
> La carga no sube por calendario, sube cuando el peso "se queda fácil" (el RIR real supera
> al objetivo). Nunca se sube con dolor. La regla de las 24h manda sobre todo lo demás.

---

## 1. Entradas y salida

**Entrada:**
- `ejercicio`: `{ rirObjetivo, reps, zonas, progresion: { incrementoKg } }` (del bloque).
- `registro`: el último `RegistroEjercicio` de ese ejercicio en el historial, con el dolor
  de esa sesión adjunto — `{ series: [{peso, reps, rir}], dolor: { post, h24 } }` — o `null`
  si nunca se hizo.

**Salida:** `{ accion, mensaje, incrementoKg, pesoSugerido, dolorAlto, empeoro24h }`
donde `accion ∈ { "subir", "mantener", "bajar", "estimar" }`.

**Definiciones:**
- `ultimoRir` = RIR de la última serie con reps registradas.
- `delta` = `ultimoRir − rirObjetivo`. `delta > 0` ⇒ se quedó fácil; `delta < 0` ⇒ fue más duro.
- `maxPost` = máximo `dolor.post[z]` sobre las `zonas` relevantes del ejercicio.
- `empeoro24h` = existe una zona relevante con `dolor.h24[z] > dolor.post[z]`.
- `dolorAlto` = `maxPost > 4`.
- `repsMin` = mínimo entero de `reps` (`"5"`→5, `"8-10"`→8, `"AMRAP"`→sin mínimo).

---

## 2. Pseudocódigo

```
función sugerirCarga(ejercicio, registro):

    # (1) Primer día / sin historial
    si registro es null o no tiene series:
        → ESTIMAR  ("elige un peso con RPE ≤6 (RIR ≥4)")

    dolor      = contextoDolor(ejercicio.zonas, registro.dolor)   # {maxPost, empeoro24h}
    serie      = última serie con reps registradas
    pesoPrevio = serie.peso

    # (2) Datos incompletos: ninguna serie con RIR
    si no hay ningún RIR registrado:
        → MANTENER  ("repite el peso y registra el RIR")

    # (3) Regla de las 24h (tiene prioridad sobre todo)
    si dolor.empeoro24h:
        → BAJAR  ("una zona empeoró a 24h: baja carga o rango")

    # (4) No completó las reps mínimas
    si repsMin definido y serie.reps < repsMin:
        → BAJAR  ("no se completaron las reps")

    # (5) Última serie sin RIR utilizable
    si serie.rir no es número:
        → MANTENER  ("mantén y registra el RIR")

    # (6) Progresión autorregulada por RIR
    delta = serie.rir − ejercicio.rirObjetivo
    dolorAlto = dolor.maxPost > 4

    si delta ≥ 1:
        si dolorAlto:  → MANTENER  ("podría subir, pero dolor >4: mantén")   # gate de dolor
        si no:         → SUBIR     (+incrementoKg)
    si delta ≤ −2:     → BAJAR     (−incrementoKg, "fue muy duro")
    si no (delta ∈ {−1, 0}):  → MANTENER
```

**Notas de diseño:**

- **El gate de dolor sólo bloquea la subida** (paso 6), tal y como pide el enunciado
  (*"NUNCA sugerir subida con dolor >4/10 … o si empeoró a 24h"*). Un dolor post >4 que
  no empeora a 24h no fuerza bajar (la regla de las 24h es el estándar clínico: molestia
  durante el ejercicio es tolerable si no empeora al día siguiente), pero sí impide subir.
- **Empeorar a 24h sí fuerza bajar** (paso 3), aplicando el principio 2 de `instrucciones.md`
  (*"si empeora a 24h, reduce carga o rango"*). Tiene prioridad sobre la lógica de RIR.
- **Tolerancia de ±1 RIR**: `delta = −1` mantiene (fue algo más duro pero aceptable). Sólo
  `delta ≤ −2` (grinding, cerca del fallo) baja. Coherente con "sin fallos, RIR ≥3".
- **Incremento único** por sesión (nunca doble), aunque el RIR sobre pase mucho el objetivo:
  fase 1 es deliberadamente lenta. El incremento lo fija cada ejercicio
  (`progresion.incrementoKg`: 2,5 kg básicos; 1–2,5 kg accesorios).
- **`pesoSugerido`** se calcula sobre el peso de la última serie (`pesoPrevio ± incrementoKg`),
  o `null` si no se puede inferir; es orientativo, el usuario ajusta con discos reales.

---

## 3. Tabla de casos de prueba

`rirObjetivo = 3`, `reps = "5"`, `incrementoKg = 2.5`, `zonas = ["rodilla"]` salvo que se indique.
`dolor` = `{ post:{...}, h24:{...} }`. Todos estos casos están en `progresion.test.mjs`.

| # | Situación | `registro` (resumen) | dolor rodilla post/h24 | Acción esperada |
|---|-----------|----------------------|------------------------|-----------------|
| 1 | Primer día | `null` | — | **ESTIMAR** |
| 2 | Sin RIR en ninguna serie | series `[{60,5,null}]` | 0 / null | **MANTENER** |
| 3 | Se quedó fácil, sin dolor | series `[{60,5,4}]` | 1 / 1 | **SUBIR** (→62,5) |
| 4 | Se quedó fácil, dolor post >4 | series `[{60,5,4}]` | 6 / 6 | **MANTENER** (gate) |
| 5 | Se quedó fácil, dolor post =4 (límite) | series `[{60,5,4}]` | 4 / 4 | **SUBIR** (4 no es >4) |
| 6 | En el objetivo | series `[{60,5,3}]` | 1 / 1 | **MANTENER** |
| 7 | Algo más duro (delta −1) | series `[{60,5,2}]` | 1 / 1 | **MANTENER** |
| 8 | Muy duro (delta ≤ −2) | series `[{60,5,1}]` | 1 / 1 | **BAJAR** (→57,5) |
| 9 | No completó reps | series `[{60,3,3}]` | 1 / 1 | **BAJAR** (→57,5) |
| 10 | Empeoró a 24h (aunque RIR alto) | series `[{60,5,4}]` | 2 / **5** | **BAJAR** (regla 24h) |
| 11 | Accesorio, incremento 1 kg, sube | series `[{20,10,5}]`, `reps "8-10"`, `inc 1` | sin zonas | **SUBIR** (→21) |
| 12 | Última serie sin RIR pero otra sí | series `[{60,5,3},{60,5,null}]` | 1 / 1 | **MANTENER** (últ. serie sin RIR) |
| 13 | Zona no relevante con dolor alto | series `[{60,5,4}]`, `zonas ["hombro"]` | rodilla 8/8 | **SUBIR** (hombro no mira rodilla) |

> Caso 13: el gate de dolor sólo mira las `zonas` declaradas del ejercicio. Un dolor de
> rodilla no bloquea la subida de un press de hombro que sólo declara `["hombro"]`.

---

## 4. Regla de adherencia — "nunca dos sesiones perdidas seguidas"

Único KPI de fase 1. **No es una racha de días consecutivos** (entrenar días seguidos no
suma adherencia y es contraproducente viniendo de destreno). Se mide sobre las **sesiones
del núcleo de 3/semana**.

### KPI semanal (S3)

- **Sesiones completadas esta semana** = nº de `RegistroSesion` de sesiones **no opcionales**
  con la semana ISO actual. Objetivo: 3. Completar la versión **mínima** cuenta igual que la
  completa.
- El **día de casa** (`opcional: true`) **no** cuenta como fallo si se salta, ni resta.
  Si se hace, suma como extra pero no es necesario para el objetivo.

### Aviso "nunca dos perdidas seguidas"

Pseudocódigo de la señal de aviso (se calcula sobre la secuencia de semanas):

```
para cada semana desde la primera con actividad:
    sesionesNucleo = completadas no opcionales en esa semana
    fallo = (sesionesNucleo == 0)            # semana sin presentarse
si dos semanas de fallo consecutivas:
    → romper: mostrar aviso rojo "dos semanas perdidas seguidas, retoma esta semana"
si la semana pasada fue fallo y esta aún 0:
    → amarillo "no falles esta semana"
si no:
    → verde
```

> Simplificación de fase 1: la señal opera a nivel de **semana** (¿te presentaste esta
> semana?), que es el disparador de hábito real, en lugar de contar sesiones perdidas
> individuales. El hito `adherencia_habito` (66 días) se considera vivo mientras no se
> produzca un "romper" (dos semanas de fallo seguidas). La evaluación completa del hito
> es S5 (fuera de este sprint); aquí queda definida la regla.

Sin gráficas, sin rachas de días, sin más métricas. Eso es fase 2.
</content>
