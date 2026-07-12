# Registro de versiones — Power Tracker

## 1.8.0 — 2026-07-12

Persistir la sugerencia de carga (subir/mantener/bajar) por ejercicio, para que
la discrepancia con lo que se hizo de verdad no se pierda antes de la revisión
semanal.

- **Sugerencia guardada junto al registro del ejercicio**: `sugerirCarga()`
  seguía usándose solo para pintar el chip en pantalla; ahora su resultado
  (`accion` + `motivo` + peso de la última vez) se guarda en el borrador al
  abrir el ejercicio y viaja con la sesión al historial y al export JSON
  (`sugerencia: {accion, motivo, pesoAnterior}`). La app sigue sin tocar el
  peso — lo escribe el usuario a mano — esto es solo un registro de qué se
  sugirió y por qué.
- **Resumen de sesión marca lo accionable**: `resumenSesion()` añade una línea
  `⚠` por ejercicio solo cuando la sugerencia fue "bajar" (se activó algún
  gate, típicamente la regla de las 24h) o cuando lo hecho contradice la
  sugerencia (sugirió mantener y se subió). Los casos coherentes (mantuvo tras
  "mantener", subió tras "subir") no se marcan. Se ve tanto en el texto para
  pegar al entrenador como en el JSON exportable.
- SW: `power-v11` → `power-v12`.

Registro de cambios notables de la app (`docs/`). No incluye el proyecto de
entreno (`tareas.md`) ni el bloque en sí (`docs/plan/bloque-actual.json`
cambia con frecuencia según la revisión semanal — eso no genera versión
nueva salvo que también cambie la app).

La versión se muestra en la app en **Ajustes** (`Version X.Y.Z`). Compárala
aquí si algo no se ve como esperas — y usa el botón **"Comprobar
actualizaciones"** en Ajustes para forzar la recarga del service worker.

## 1.7.0 — 2026-07-12

Cierre de los issues P2 del backlog de bugs/fricción. Varios ya estaban resueltos
por sprints anteriores; se verificó cada uno contra el código antes de tocar nada.

- **Nota por ejercicio ahora visible al revisar después**: la nota (F1) se
  guardaba pero `historialEjercicio`/"Ver histórico" no la mostraba — sólo
  aparecía en el resumen justo al cerrar la sesión. Ahora se ve también al
  volver semanas después.
- **Timer de descanso**: verificado en vivo (cambio de pestaña + recarga de
  página) — ya funcionaba correctamente desde B2 (v1.2.0). Sin cambios.
- **Textos instructivos repetidos**: verificado — F4 (v1.2.0) ya centraliza el
  texto de "primera vez" a nivel de sesión; lo que aparece por ejercicio es la
  sugerencia de carga real (dato calculado, no texto genérico). Sin cambios.
- **Duración de sesión eliminada** (rama A del issue): no aportaba al único
  KPI (sesiones/semana), un cronómetro ingenuo cuenta tiempo en
  background/días si la sesión queda a medias (de ahí los "360 min" falsos:
  el cap de seguridad, no un tiempo real), y el propio diseño de fase 1 es
  "cero métricas de vanidad". Se quita `duracionSeg` del registro y de los
  resúmenes.
- **"Cómo sigues hoy" fusionado con "Molestias de hoy"**: eran dos tarjetas
  con sliders de dolor casi idénticos. Ahora es una sola, colapsada por
  defecto (como el calentamiento), con las 4 zonas (lumbar, rodilla, hombro,
  trapecio) y una caja de notas. Si hay una pregunta de 24h pendiente sobre la
  última sesión, la misma tarjeta se abre automáticamente y esos valores
  también resuelven el gate de seguridad de progresión (regla de las 24h) —
  no hace falta responder dos veces la misma pregunta.
- SW: `power-v10` → `power-v11`.

**Corrección posterior en `bloque-actual.json` (mismo día, no cambia versión de
app):** el correctivo entre series (v1.6.0) colgaba del último accesorio de
cada día (remo, face-pull, remo-mancuerna), copiando el orden de la tabla de
`bloque1_powerlifting.md`. El documento dice explícitamente "el descanso del
básico ES el hueco" — va en los descansos del básico (180-210s), no del
accesorio (60-90s, mucho menos margen real). Movido a sentadilla / press
banca / peso muerto. Efecto bueno: al colgar de un ejercicio no recortable,
ahora también sobrevive a "voy justo".

## 1.6.0 — 2026-07-12

- **Bug (progresión sesgada)**: el ejercicio `press-banca` del Día 1 (secundario,
  3×6-8) compartía `id` con el del Día 2 (básico, 4×5-6). Como la sugerencia de
  carga compara la última serie registrada contra el rango de reps del ejercicio
  que abres, una sesión de Día 2 completada a 5 reps (su objetivo, 5-6) se leía en
  el Día 1 como "no completaste las reps (5/6)" y sugería bajar peso sin motivo.
  Se le da un `id` propio (`press-banca-secundario`) para que cada esquema
  progrese con sus propios datos. Reproducido y verificado con Playwright antes y
  después del fix (ver `schema.md` para la regla general).
- **Correctivos "entre series" ausentes**: face pull/dead bug (Día 1), rueda
  abdominal (Día 2) y core suave/respiración (Día 3) no existían en
  `bloque-actual.json` — no se mostraban en ningún sitio, ni siquiera como bloque
  aparte. Se añaden y se renderizan anidados dentro de la tarjeta del ejercicio
  cuyo descanso ocupan (no como lista separada al final de la sesión), tanto en
  el registro en vivo como en Plan → Sesiones.
- SW: `power-v9` → `power-v10`.

## 1.5.0 — 2026-07-09

- **Check-in de dolor sin sesión**: nueva tarjeta arriba de todo en "Hoy"
  ("Molestias de hoy") para anotar una molestia por zona (incluido trapecio)
  en cualquier momento, sin tener que abrir y cerrar un entreno. Vive un
  solo día (se resetea al día siguiente); no sustituye el dolor de cierre de
  sesión, que sigue siendo el que gatea la progresión de carga.
- SW: `power-v8` → `power-v9`.

## 1.4.0 — 2026-07-09

Mejoras a partir de dos revisiones independientes (investigación de fuentes
UX expertas + revisión de producto con Fable):

- **Stepper +/- para el RIR** en el registro de cada serie, en vez del
  teclado numérico del sistema (NN/G "Input Steppers", Apple HIG
  "Steppers"): el RIR nunca se precarga y tiene rango pequeño y fijo, el
  caso ideal para evitar el teclado con dedos sudados/con tiza entre series.
- **"Te toca" en Hoy**: la app destaca la siguiente sesión del núcleo según
  la rotación real (no el día de la semana, que es solo orientativo), en
  vez de que haya que recordar cuál corresponde.
- **Auto-reanudar sesión de hoy**: si Android mata la PWA a media sesión, al
  reabrir la app se retoma directo (ya no hay que pulsar "Reanudar" cada
  vez). Un borrador de otro día sigue sin auto-abrirse (eso seguía siendo B1).
- **Limpieza**: fuera la tarjeta de "exportar una sesión suelta" en Ajustes
  (duplicaba el botón que ya existe en la propia pantalla de resumen al
  cerrar sesión, y competía con el markdown, que es lo que de verdad usa el
  entrenador).
- SW: `power-v7` → `power-v8`.

## 1.3.0 — 2026-07-09

- Bloque 1 reescrito para alinearse exactamente con `bloque1_powerlifting.md`
  (documento fuente): 6 semanas, RIR ≥4 en básicos, cap de esfuerzo escalonado
  por tipo de ejercicio, ejercicios/días corregidos.
- Plan → Ejercicios: pasa de mostrar la ficha completa apilada a una lista
  simple; tocar una fila abre el histórico, botón ⓘ abre la ficha (esquema +
  claves).
- Nueva zona de dolor: **trapecio**, añadida al cierre de sesión, la
  pregunta a 24h y el resumen del entrenador; etiquetada en los ejercicios de
  tirón/espalda alta para que también la proteja el gate de progresión.
- Indicador de versión + botón "Comprobar actualizaciones" en Ajustes (este
  registro).
- SW: `power-v5` → `power-v7`.

## 1.2.0 — 2026-07-08 — Sprint 2

- **B1**: arreglado que "Hoy" a veces mostrara el borrador de una sesión sin
  terminar en vez del resumen del bloque.
- **B2**: el temporizador de descanso ya no se resetea al cambiar de pestaña
  (persiste por timestamp en localStorage).
- **F1**: notas por ejercicio, incluidas en el resumen del entrenador.
- **F2**: exportar una sesión suelta (además del historial completo).
- **F3**: histórico por ejercicio (fecha/peso/reps/RIR).
- **F4**: notas puntuales de sesión-día (`notaPrimeraVez`, `notaSesion`) en
  vez de texto fijo repetido en cada ejercicio.

## 1.1.0 — 2026-07-07

- Bloque de calentamiento/movilidad con esquemas SVG propios por ejercicio.
- Fichas de ejercicio (esquema + claves + qué evitar).
- Limpieza de UI e icono de la PWA.

## 1.0.0 — 2026-07-07

- Primera versión funcional: modelo de datos y algoritmo de progresión (O1),
  scaffolding PWA instalable (S1), pantalla de sesión y registro por serie
  (S2), progresión/cierre de sesión/adherencia (S3), resumen del entrenador
  y export/import (S4), motor de gamificación por fases (S5), revisión final
  (O3).
