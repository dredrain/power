# PLAN.md — Power Tracker (app de seguimiento de entrenos)

> Creado: 2026-07-07 (sesión 1, Fable). Este documento es la referencia para las
> sesiones de implementación con Opus y Sonnet. Leer junto con `instrucciones.md`
> (rol de entrenador y principios: adherencia > rendimiento, RPE ≤7 en fase 1,
> regla de las 24h para dolor, 3 días/semana + día de casa opcional).

## 1. Qué es

PWA (web app instalable) alojada en **GitHub Pages**, usada desde el móvil Android
en el gimnasio. Simple y eficaz: una pantalla de sesión, registro por serie,
memoria de pesos, y resumen para el entrenador (Claude).

**Flujo de datos:**

```
Claude (este entorno) ──escribe──> plan/bloque-XX.json ──push──> GitHub Pages
                                                                      │
Móvil (PWA) <──descarga plan── ────────────────────────────────────────┘
   │  registra series (peso/reps/RIR) en localStorage (offline-first)
   │
   └──"Resumen de sesión" (texto) ──copiar/compartir──> pegar a Claude
                                        Claude ajusta el bloque si toca (revisión semanal)
```

- La app es **autónoma en el día a día**: calcula la sugerencia de carga con el
  historial local, sin necesitar a Claude.
- Claude interviene en la **revisión semanal** (feedback de dolor/fatiga/adherencia,
  según `instrucciones.md`) y al cambiar de bloque: edita el JSON del plan y hace push.

## 2. Funcionalidades del MVP

1. **Sesión de hoy**: ejercicios del plan con series×reps prescritas, RIR objetivo,
   y el peso de la última sesión al lado de cada ejercicio.
2. **Registro por serie**: peso, reps, RIR. Botones grandes (uso con manos de gym),
   valores precargados con los de la última vez.
3. **Sugerencia de carga** (subir / mantener / bajar) al abrir cada ejercicio,
   calculada con el último RIR vs. el objetivo y el check de dolor previo.
   Fase 1 conservadora: RPE ≤7 ⇒ RIR objetivo ≥3; nunca sugerir subida tras dolor >4
   o si empeoró a 24h.
4. **Versión mínima**: toggle "voy justo" que deja solo el básico + accesorios
   no recortables (marcados en el plan). Completarla cuenta como sesión completada.
5. **Check de dolor al cerrar sesión**: lumbar / rodilla externa / hombro, 0-10,
   + pregunta de 24h sobre la sesión anterior. Alimenta la sugerencia de carga
   y el resumen.
6. **Resumen para el entrenador**: texto markdown generado al cerrar sesión
   (fecha, ejercicios con pesos×reps@RIR, dolor por zona, fatiga, duración,
   completa/mínima) con botón copiar/compartir para pegarlo en Claude.
7. **Adherencia**: sesiones completadas/semana (el único KPI de fase 1) y aviso
   de "nunca dos perdidas seguidas". **Sin rachas de días consecutivos, sin stats.**
8. **Temporizador de descanso**: arranca al marcar una serie, con el descanso
   prescrito por ejercicio. Vibración/sonido al acabar.
9. **Día de casa opcional**: sesión de gomas/dominadas/rueda en el plan, marcada
   `opcional: true` — no cuenta como fallo ni afecta a la adherencia si se salta.

**Fuera del MVP (fase 2, tras ~66 días de hábito):** gráficas de progresión,
% sobre máximos históricos, hitos motivacionales, nutrición.

## 3. Stack y decisiones técnicas

- **Vanilla HTML/CSS/JS, sin build, sin frameworks, sin dependencias.** El proyecto
  es pequeño y así cualquier sesión de Claude puede editarlo sin tooling.
- **PWA**: `manifest.json` + service worker (cache-first para la app, network-first
  con fallback a caché para el plan JSON) ⇒ funciona sin cobertura en el gimnasio.
- **Datos**:
  - `docs/` como raíz de GitHub Pages (la app vive ahí).
  - `docs/plan/bloque-actual.json` — el bloque vigente, escrito por Claude.
  - Historial de sesiones en `localStorage` del móvil (clave por fecha).
  - Export JSON completo (botón en ajustes) por si hay que restaurar o auditar.
- **Repo**: hay que hacer `git init`, crear repo en GitHub y activar Pages
  (el directorio aún no es repo git).

### Esquema del plan (resumen; Opus lo cierra en la tarea O1)

```json
{
  "bloque": 1, "semanas": 5, "fase": 1,
  "sesiones": [{
    "id": "A", "nombre": "Sentadilla + empuje",
    "ejercicios": [{
      "nombre": "Sentadilla", "series": 3, "reps": "5",
      "rirObjetivo": 3, "descansoSeg": 180,
      "recortable": false, "notas": "parar con técnica limpia",
      "progresion": { "incrementoKg": 2.5, "regla": "rir" }
    }]
  }]
}
```

## 4. Reparto de tareas por sesión y modelo

**Criterio**: Opus para diseño con criterio (modelo de datos, algoritmo de
progresión, contenido del entreno, revisión final); Sonnet para implementación
bien especificada. Fable solo esta primera sesión (plan).

| # | Modelo | Tarea | Entregable |
|---|--------|-------|------------|
| 0 | Fable | ✅ Plan y arquitectura (esta sesión) | `PLAN.md` |
| 1 | **Opus** | **O1 — Modelo de datos + algoritmo de progresión.** Cerrar esquemas de `plan.json` y del log de sesión; especificar las reglas subir/mantener/bajar (RIR vs objetivo, dolor 0-10, regla 24h, incrementos por ejercicio) como pseudocódigo testeable. | `docs/plan/schema.md` + spec del algoritmo |
| 2 | **Opus** | **O2 — Primer bloque de entreno (4-6 semanas).** Trabajo de *entrenador*: 3 sesiones/semana + día de casa, versión completa y mínima, RPE ≤7, accesorios justificados según lumbar/rodilla/hombro (ver `instrucciones.md`). En formato `bloque-actual.json`. | `docs/plan/bloque-actual.json` |
| 3 | Sonnet | **S1 — Scaffolding.** `git init`, repo GitHub, Pages activado, estructura `docs/`, PWA base (manifest, service worker, layout móvil, navegación). | app vacía instalable en el móvil |
| 4 | Sonnet | **S2 — Pantalla de sesión + registro.** Render del plan JSON, registro por serie (peso/reps/RIR), precarga de últimos valores, localStorage, toggle versión mínima, temporizador de descanso. | núcleo funcional |
| 5 | Sonnet | **S3 — Progresión + cierre de sesión.** Implementar el algoritmo de O1 (sugerencias de carga), check de dolor por zona, pregunta 24h, adherencia semanal con regla "nunca dos seguidas". | app completa el ciclo |
| 6 | Sonnet | **S4 — Resumen del entrenador + export.** Generador del resumen markdown, botón copiar/compartir (Web Share API), export/import JSON del historial. | resumen listo para pegar a Claude |
| 7 | **Opus** | **O3 — Revisión final.** Code review, probar el flujo completo contra `instrucciones.md` (¿el MVP respeta fase 1?), pulir sugerencias, checklist de prueba en móvil real. | v1.0 lista |

**Orden**: O1 → S1 → S2 → (O2 en paralelo con S2/S3) → S3 → S4 → O3.
S2 puede empezar con un bloque de ejemplo si O2 no está listo.

## 5. Criterios de éxito de la v1

- Instalo la app desde el móvil y abro la sesión de hoy sin conexión.
- Registro una sesión completa en <30 s de interacción extra sobre el entreno.
- La app me dice qué peso poner sin que yo tenga que recordar nada.
- El resumen pegado a Claude contiene todo lo que piden las instrucciones
  (dolor por zona, sesiones completadas, fatiga) para la revisión semanal.
- Cero métricas de vanidad: solo adherencia, como manda la fase 1.

## 6. Estado y pendientes

- **Repo**: `https://github.com/dredrain/power` (decidido 2026-07-07). Repo git
  local inicializado y con remote configurado. ⚠️ Pendiente del usuario: el repo
  no existe aún en GitHub (o es privado) — debe crearse **público**, porque
  GitHub Pages gratuito solo funciona en repos públicos.
- `tareas.md` actualizado por el usuario (2026-07-07): ahora es el tablero del
  proyecto de *entreno* (no de la app). Ojo: sitúa la app en "más adelante
  (mes 4+)" y pide solo un tracker mínimo en fase 1 — el usuario ha decidido
  explícitamente adelantar la app (esta sesión). El MVP se mantiene deliberadamente
  mínimo y sin gamificación para respetar el espíritu de esa nota: la app no debe
  competir en tiempo/energía con ir al gimnasio.
