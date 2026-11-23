v1.11.1 — Avisos de copias y actualizaciones atascadas

### Correcciones
- **Avisos de copias**: los avisos de fallo de las copias de las apps (que se quitaron en la v1.10.0) nunca se cerraban y no se podían descartar. Ahora se cierran solos cuando MyHomeLab arranca. La copia del propio MyHomeLab sigue avisando como antes.
- **Actualizaciones**: instalar Claude Code durante una actualización tiene ahora un límite de 5 minutos. Si npm se cuelga, la actualización muestra un aviso y sigue, en lugar de quedarse atascada en "Installing Claude Code…".
