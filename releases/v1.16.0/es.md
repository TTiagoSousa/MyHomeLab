v1.16.0 — Cada app tiene su cron job de actualizaciones

### Novedades
- **Cron job de actualizaciones en cada app self-hosted**: cada app de la que MyHomeLab sabe ver la versión tiene ahora el botón "Cron jobs", con "Actualizaciones de la app". Home Assistant tiene también uno para los add-ons, HACS y firmware, y Nextcloud uno para las apps de Nextcloud. Eliges cada cuánto se ejecuta y, en Opciones, activas "Poner en un proyecto" y eliges el proyecto y la columna. En "Esperando estudio", el estudio empieza solo y sigue el camino de siempre (solo instala con tu sí). En "Todo", la tarea espera hasta que la arrastres. Se ejecuta en código, sin IA ni tokens, y recoge también las actualizaciones que ya esperaban a ser abiertas. Si la misma app o componente ya tiene una actualización abierta, la nueva espera a la siguiente vez.

### Correcciones
- **Nombres de las medidas de Salud**: las medidas de la composición corporal tienen ahora los nombres habituales, como "Porcentaje de grasa corporal", "Masa de músculo esquelético" y "TMB", con sus unidades.
