v1.8.1 — Fallos de servicios que se cierran solos

### Correcciones
- **Fallos de los servicios en el tablero**: cuando un servicio vigilado se caía, su tarea se quedaba en Todo después de que el servicio volviera, esperando a que un agente la cerrara (y si el agente no tenía acceso al tablero, nunca se cerraba). Ahora, cuando el servicio vuelve a responder, MyHomeLab dice cuánto tiempo estuvo caído y pasa la tarea a Verifying; estable durante 10 minutos, la cierra en Done. Si la tarea espera tu respuesta (o alguien la movió), se queda como está.
- **Fallos durante una actualización**: mientras una app (o el Proxmox del servidor) se está actualizando, que el servicio se caiga unos minutos ya no abre una tarea de fallo — queda anotado en la tarea de la actualización. La notificación sigue abriéndose y cerrándose sola.
