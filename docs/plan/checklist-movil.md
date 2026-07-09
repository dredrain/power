# Checklist de prueba en móvil real (O3)

> Recorrido manual para validar la v1 en el Android antes de fiarte de ella en el gimnasio.
> Marca cada punto. Si algo falla, anótalo para la revisión con el entrenador.

## Instalación y arranque
- [ ] Abrir `https://dredrain.github.io/power/` en Chrome Android.
- [ ] Aparece el banner / opción **"Añadir a pantalla de inicio"**; instalar.
- [ ] El icono (barra) sale en el escritorio y abre a **pantalla completa** (sin barra del navegador).
- [ ] Cierra datos y wifi (modo avión) y **reabre**: la app carga igual (offline). El badge "sin conexión" aparece.

## Sesión y registro (S2)
- [ ] En **Hoy** salen las 3 sesiones de gimnasio + el día de casa marcado "opcional".
- [ ] "Empezar sesión" en A: se ven los ejercicios con el básico (Sentadilla) primero.
- [ ] Los campos **kg/reps** vienen precargados con la última vez (la 1ª vez están vacíos con aviso "elige RPE ≤6").
- [ ] Escribir peso/reps/RIR con una mano: los campos son grandes y el teclado numérico sale bien.
- [ ] Marcar una serie (✓): arranca el **temporizador de descanso** con los segundos del ejercicio.
- [ ] Al llegar a 0 el móvil **vibra** y suena un pitido. "+30s" y "Saltar" funcionan.
- [ ] Activar **"Voy justo"**: desaparecen los accesorios recortables, quedan básico + ancla.
- [ ] Salir de la app y volver: la sesión **se reanuda** donde estaba ("Reanudar sesión").

## Progresión y dolor (S3)
- [ ] Al abrir cada ejercicio aparece la **sugerencia** (Subir/Mantener/Bajar/Estimar) con color y peso.
- [ ] "Terminar sesión" → pide **dolor por zona** (lumbar/rodilla/hombro/trapecio) y **fatiga**, con deslizadores.
- [ ] Al día siguiente, al abrir la app, pregunta **cómo siguen a 24h** las zonas que dolieron (>0).
- [ ] Registrar una serie fácil (RIR alto) y sin dolor → la próxima vez sugiere **Subir**.
- [ ] Poner dolor 24h peor que el del día → sugiere **Bajar** (regla de las 24h).

## Adherencia (S3) y gamificación (S5)
- [ ] **Adherencia** muestra los puntos de la semana (x/3) y el semáforo con su mensaje.
- [ ] Completar la **versión mínima** cuenta como sesión (suma al x/3).
- [ ] Saltar el **día de casa** NO baja la adherencia ni pone el semáforo en rojo.
- [ ] Se ve **un único hito** (66 días de hábito) con barra de progreso y premio. Ningún hito de fase 2.

## Resumen y datos (S4)
- [ ] Tras cerrar, sale el **resumen markdown** con series, dolor, 24h y fatiga.
- [ ] "Copiar / compartir": abre el menú de compartir de Android (o copia al portapapeles).
- [ ] Pegarlo en la conversación con Claude se ve limpio y completo.
- [ ] En **Adherencia**, "Copiar resumen semanal" genera el resumen de la semana.
- [ ] En **Ajustes**, "Exportar historial" descarga un `.json`; pegar ese JSON en "Importar" lo restaura.

## Novedades v1.1 (icono, calentamiento, fichas, secciones)
- [ ] Tras desplegar, abre la app **dos veces** (para que el service worker `power-v2` se active) y comprueba en **modo avión** que cargan la pestaña **Info**, la sub-pestaña **Ejercicios** (con sus esquemas) y el **calentamiento** de una sesión.
- [ ] El **icono** en la pantalla de inicio es el nuevo (barra con degradado y brillo, no el plano).
- [ ] Al **empezar una sesión** sale arriba el **Calentamiento · movilidad** plegable; marcar ítems los tacha y sube el contador (x/y).
- [ ] El calentamiento se ve **también con "voy justo"** activado (no se recorta).
- [ ] Cerrar y reabrir la app a mitad de sesión: los ítems de calentamiento marcados **se conservan**.
- [ ] En un ejercicio, **"Ver ficha del ejercicio"** abre un modal con esquema + claves; **cerrarlo NO reinicia el temporizador** de descanso si estaba corriendo.
- [ ] **Plan → Ejercicios**: fichas de todos los ejercicios del bloque con su esquema SVG.
- [ ] **Plan → Sesiones**: cada ejercicio con ficha es tocable (ⓘ) y abre su ficha.
- [ ] Pestaña **Info**: se leen las aclaraciones (adherencia, 24h, RIR, fisio…).
- [ ] La **rueda ⚙** de la cabecera abre **Ajustes** (exportar/importar, recargar plan).
- [ ] **Día de casa (D) + "voy justo"**: queda al menos las **dominadas** (ancla), no una pantalla vacía.

## Comprobación contra `instrucciones.md` (fase 1)
- [ ] El único KPI visible es **sesiones/semana**. No hay gráficas, PRs ni % de máximos.
- [ ] La gamificación muestra **solo adherencia**. Nada de kilos ni vanidad.
- [ ] Los pesos iniciales se plantean como "**a rellenar con RPE ≤6**", no como % de 120/180/220.
- [ ] Ningún mensaje empuja a subir carga con dolor o entrenando días seguidos.

## Notas de la prueba
_(apunta aquí lo que falle o chirríe para la revisión)_
