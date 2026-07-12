# Esquema de datos — Power Tracker (O1)

> Documento de referencia para la implementación. Define tres estructuras:
> 1. **`bloque-actual.json`** — el bloque de entreno vigente (lo escribe Claude/entrenador).
> 2. **Log de sesión** en `localStorage` — el historial que registra el móvil (offline-first).
> 3. **`hitos.json`** — logros/hitos/premios con activación por fases.
>
> Principios que condicionan el diseño (`instrucciones.md`): adherencia > rendimiento,
> fase 1 con RPE ≤7 / RIR ≥3 sin fallos, regla de las 24h para el dolor, único KPI =
> sesiones completadas/semana. **Cero métricas de vanidad en fase 1.**

---

## 1. `docs/plan/bloque-actual.json`

El bloque vigente. Se sirve por GitHub Pages (network-first con fallback a caché).

### Estructura

```jsonc
{
  "bloque": 1,                       // nº de bloque (entero, incremental)
  "fase": 1,                         // fase de entrenamiento (1 = adherencia)
  "semanas": 5,                      // duración prevista (4-6 semanas)
  "creado": "2026-07-07",            // fecha ISO de creación del bloque
  "titulo": "Bloque 1 — Reentrada",  // nombre legible
  "notas": "Cargas a rellenar en la primera sesión con RPE ≤6. …",
  "progresionGlobal": {              // reglas por defecto, sobreescribibles por ejercicio
    "regla": "rir",
    "rirObjetivoDefecto": 3
  },
  "sesiones": [ Sesion, … ]
}
```

### `Sesion`

```jsonc
{
  "id": "A",                         // identificador corto y estable dentro del bloque
  "nombre": "Sentadilla + tirón",
  "opcional": false,                 // true SOLO para el día de casa (no cuenta como fallo)
  "diaSugerido": "lunes",            // orientativo; el usuario entrena cuando puede
  "duracionCompletaMin": 70,         // estimación versión completa
  "duracionMinimaMin": 42,           // estimación versión mínima ("voy justo")
  "notaPrimeraVez": "Elige…",        // opcional; ver "Notas por sesión-día" abajo
  "notaSesion": "Estirar al acabar", // opcional; ver "Notas por sesión-día" abajo
  "calentamiento": Calentamiento,    // opcional; se muestra al empezar la sesión
  "ejercicios": [ Ejercicio, … ]
}
```

#### Notas por sesión-día (`notaPrimeraVez`, `notaSesion`)

Ambas **opcionales**. Alojan las instrucciones puntuales de esa sesión/semana (p. ej.
"primera vez: elige peso con RPE ≤6", "estirar al acabar") en la **particularidad de la
sesión**, no en las `notas` generales de cada ejercicio —que se repetirían en cada tarjeta.
Se muestran una sola vez, en una tarjeta destacada al abrir la sesión:

| Campo | Cuándo se muestra |
|-------|-------------------|
| `notaPrimeraVez` | Sólo la **primera vez** que se hace esa sesión-día (no hay ningún registro suyo en el historial). Reemplaza al antiguo texto fijo "primera vez: elige un peso cómodo (RPE ≤6)" que aparecía repetido en todos los ejercicios. |
| `notaSesion` | **Siempre** que se abre la sesión (recordatorio permanente del día). |

### `Calentamiento` (opcional en `Sesion`)

Guía de calentamiento + movilidad específica del día. **No es un ejercicio recortable**:
se muestra al abrir la sesión (también en "voy justo") como checklist plegable y **no
cuenta como KPI ni entra al historial** — el estado de los checks vive solo en el borrador.
Es el hueco donde vive el trabajo correctivo integrado (`instrucciones.md`, fase 1: el
prehab va en el calentamiento y entre series, no como bloque aparte que se recorta).

```jsonc
{
  "duracionMin": 5,                  // estimación (para la etiqueta)
  "nota": "Correctivo integrado…",   // una línea corta; el "por qué" vive en Aclaraciones
  "items": [
    { "nombre": "Gato-camello", "detalle": "x8 lento", "zona": "lumbar" }
    // zona ∈ ["lumbar","rodilla","hombro","trapecio"] o null (solo informativo)
  ]
}
```

- El **día de casa** es la única sesión con `"opcional": true`. Saltarla **no** rompe la
  adherencia (ver `progresion.md` y S3).
- El orden del array de `ejercicios` es el orden de ejecución: **el básico va primero**
  (principio de fase 1: se abre con lo que motiva).

### `Ejercicio`

```jsonc
{
  "id": "sentadilla",                // estable dentro del bloque; clave para casar historial
  "nombre": "Sentadilla",
  "tipo": "basico",                  // "basico" | "accesorio"
  "series": 3,                       // nº de series de trabajo (entero)
  "reps": "5",                       // string: "5" (fijo) o "8-10" (rango) o "AMRAP"
  "rirObjetivo": 3,                  // RIR objetivo (fase 1: ≥3). Autorregula la progresión.
  "descansoSeg": 180,                // descanso entre series → temporizador
  "recortable": true,               // si false, sobrevive al modo "voy justo" (versión mínima)
  "zonas": ["rodilla", "lumbar"],    // zonas problemáticas relevantes → gate de dolor
  "notas": "Profundidad cómoda, sin buscar ROM máximo esta semana.",
  "progresion": {
    "regla": "rir",                  // "rir" (autorregulado) por defecto en fase 1
    "incrementoKg": 2.5,             // 2.5 básicos; 1–2.5 accesorios
    "cargaInicial": null             // null = "a rellenar en 1ª sesión con RPE ≤6"
  },
  "correctivo": {                    // opcional; ver "Correctivo entre series" abajo
    "nombre": "Face pull o dead bug",
    "detalle": "1 serie en el hueco del descanso; no compite con el básico",
    "zona": null                     // zona protegida, o null
  }
}
```

#### `correctivo` (opcional en `Ejercicio`)

El trabajo correctivo que se hace **en el hueco del descanso** de este ejercicio (no
del calentamiento). Se ancla al ejercicio cuya serie precede el hueco — normalmente el
último accesorio del día — y la app lo renderiza **anidado dentro de esa misma
tarjeta**, nunca como bloque aparte al final de la sesión (`bloque1_powerlifting.md`:
"el descanso del básico ES el hueco… el filler no compite con el básico"). Es un
checklist como el del calentamiento: el estado (`correctivoHecho`) vive en el borrador
y no entra al historial ni al KPI.

**Campos clave y por qué:**

| Campo | Uso |
|-------|-----|
| `id` | Casa el ejercicio con su historial en `localStorage` entre sesiones. **No cambiar** dentro de un bloque. **No reutilizar** el mismo `id` en dos ejercicios con `series`/`reps`/`rirObjetivo` distintos (p. ej. el mismo movimiento como básico un día y accesorio otro): la progresión compara la última serie registrada contra el `reps`/`rirObjetivo` del ejercicio que se está abriendo, así que un `id` compartido con esquemas distintos sesga "subir/bajar" con datos de la sesión equivocada. Si el movimiento se repite con otro esquema, usa un `id` distinto (p. ej. `press-banca-secundario`). |
| `reps` como *string* | Permite reps fijas (`"5"`), rango (`"8-10"`) o `"AMRAP"`. El algoritmo extrae el mínimo del rango. |
| `rirObjetivo` | Núcleo de la progresión autorregulada: la carga sube cuando el RIR real supera al objetivo (el peso "se quedó fácil"). |
| `recortable` | `false` en el básico y en el trabajo correctivo no negociable; esos sobreviven a la versión mínima. |
| `zonas` | Subconjunto de `["lumbar","rodilla","hombro","trapecio"]`. Activa el gate de dolor (nunca subir con dolor >4 o empeora a 24h en una zona relevante). Vacío = sin gate. |
| `progresion.incrementoKg` | Incremento sugerido al subir. |
| `progresion.cargaInicial` | `null` deliberado: fase 1 no parte de % de PRs antiguos, se rellena en la 1ª sesión con RPE ≤6. |

---

## 2. Log de sesión (`localStorage`)

Offline-first. El historial es la fuente de verdad para la progresión y la adherencia.

### Claves

| Clave | Contenido |
|-------|-----------|
| `power:historial` | Array JSON de `RegistroSesion`, ordenado por `fecha` ascendente. |
| `power:borrador` | `RegistroSesion` en curso (sesión abierta y no cerrada). Se limpia al cerrar. |
| `power:config` | Preferencias (última versión usada, etc.). |
| `power:cacheBloque` | Copia del último `bloque-actual.json` descargado (respaldo del SW). |

> Se usa un único array `power:historial` (no una clave por fecha) para simplificar el
> cálculo de adherencia y de "última vez que hice este ejercicio". El export/import de
> fase 2 (S4) serializa exactamente este array.

### `RegistroSesion`

```jsonc
{
  "fecha": "2026-07-08",             // ISO date de realización (clave lógica)
  "iso": "2026-07-08T08:12:00.000Z", // timestamp de cierre (desempate, orden real)
  "bloque": 1,
  "sesionId": "A",                   // casa con Sesion.id del bloque
  "version": "completa",             // "completa" | "minima"
  "completada": true,                // true si se cerró (mínima cuenta como completada)
  "ejercicios": [ RegistroEjercicio, … ],
  "dolor": {                         // check de dolor por zona, 0–10
    "post":  { "lumbar": 2, "rodilla": 1, "hombro": 0, "trapecio": 0 },   // al cerrar ESTA sesión
    "h24":   { "lumbar": null, "rodilla": null, "hombro": null, "trapecio": null } // se rellena al abrir la SIGUIENTE
  },
  "fatiga": 5,                       // fatiga general 0–10 al cerrar (para la revisión semanal); null si no se registró
  "notas": ""
}
```

- `dolor.post`: se registra en el **cierre** de la sesión (paso obligatorio de S3).
- `dolor.h24`: **null al crearse**; se rellena de forma retroactiva cuando el usuario abre
  la siguiente sesión y responde la "pregunta 24h" sobre la sesión anterior. Esto permite
  al algoritmo saber si una zona **empeoró a 24h** (`h24[z] > post[z]`).
- `completada: false` sólo si el usuario abandona sin cerrar (queda en `power:borrador`,
  no entra al historial). Para adherencia, todo lo que está en `power:historial` cuenta.
- **No se mide `duracionSeg`** (deliberado): el único KPI de fase 1 es sesiones/semana, y
  un reloj de pared entre "abrir" y "cerrar" sesión cuenta tiempo en background/días si la
  sesión queda a medias — dato falso, no vanidad útil. Si algún día se quiere de verdad,
  hace falta la Page Visibility API para descontar el tiempo fuera de foco, no solo un
  cronómetro ingenuo.

### `RegistroEjercicio`

```jsonc
{
  "ejercicioId": "sentadilla",       // casa con Ejercicio.id
  "series": [
    { "peso": 60, "reps": 5, "rir": 3 },   // una entrada por serie de trabajo
    { "peso": 60, "reps": 5, "rir": 2 }
  ],
  "notas": "hoy la rodilla mejor"    // opcional (F1): nota libre por ejercicio; ausente si vacía
}
```

- Cada serie: `peso` (kg, número), `reps` (número), `rir` (0–10 o `null` si no se registró).
- Precarga: al abrir el ejercicio, los campos se rellenan con los valores de la **última
  vez** que se hizo (misma `ejercicioId`, sesión más reciente del historial).
- `notas` (F1): texto libre que el usuario escribe por ejercicio durante la sesión. Sólo se
  guarda si no está vacío. Se incluye en el resumen del entrenador. Un ejercicio con nota
  pero **sin** series registradas también se conserva (para no perder la observación).

---

## 3. `docs/plan/hitos.json`

Motor de gamificación genérico; el contenido lo dosifica el entrenador editando el JSON.
En **fase 1 sólo hay UN hito activo y visible**: la adherencia ~66 días.

### Estructura

```jsonc
{
  "version": 1,
  "hitos": [ Hito, … ]
}
```

### `Hito`

```jsonc
{
  "id": "adherencia-66",
  "titulo": "66 días de hábito",
  "descripcion": "Presentarte de forma sostenida sin dos sesiones perdidas seguidas.",
  "fase": 1,                         // 1 | 2 — sólo se muestran los de la fase actual
  "activo": true,                    // false = existe en el motor pero oculto (lo activa el entrenador)
  "premio": "Camiseta de power",     // opcional, ligado al hobby (no a comida); "" o ausente si ninguno
  "condicion": {
    "tipo": "adherencia_habito",     // ver catálogo de tipos abajo
    "dias": 66
  }
}
```

### Catálogo de `condicion.tipo` (evaluables contra `power:historial`)

| `tipo` | Parámetros | Evaluación |
|--------|-----------|------------|
| `adherencia_habito` | `dias` | Días transcurridos desde la 1ª sesión **sin haber incumplido** "nunca dos sesiones perdidas seguidas". El único hito de fase 1. |
| `sesiones_totales` | `n` | Nº de sesiones completadas en el historial ≥ `n`. (fase 2) |
| `reps_ejercicio` | `ejercicioId`, `reps` | Alguna serie registrada de `ejercicioId` con `reps ≥` valor (p. ej. 10 dominadas). (fase 2) |
| `carga_ejercicio` | `ejercicioId`, `kg` | Algún `peso ≥ kg` en `ejercicioId` (p. ej. % sobre máximos 120/180/220). (fase 2) |

- La app en fase 1 **sólo evalúa y muestra** hitos con `fase === faseActual && activo === true`.
- El motor completo (evaluar todos los tipos, celebración al desbloquear) es S5 — **fuera
  de este sprint**. En este sprint `hitos.json` se entrega con el contenido correcto y el
  esquema cerrado; la evaluación viva llega en S5.

### Regla de adherencia (detallada en `progresion.md`)

`adherencia_habito` **no** es una racha de días consecutivos. Se basa en la regla operativa
de `instrucciones.md`: *nunca dos sesiones (de las 3 semanales) perdidas seguidas*. El día
de casa (`opcional: true`) no computa como fallo. Ver `progresion.md §4`.
</content>
