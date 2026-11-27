v1.18.0 — Lo que está todo bien se instala solo, y el asistente activa los cron jobs de las actualizaciones

### Cambios
- **Lo que está todo bien se instala solo**: después del estudio, si todo está bien (no se rompe nada y se puede volver atrás), la actualización pasa directamente a "Ready to update" y se instala. Lo que falte y tenga una solución segura, como una copia de seguridad o espacio libre, se resuelve al empezar la instalación. Un salto major, riesgo alto, pasos a mano o una actualización de Proxmox sin riesgo bajo siguen en "Waiting for reply", esperando tu sí.
- **Siempre en "Espera de estudio"**: en las opciones del cron job de las actualizaciones solo eliges el proyecto. Las versiones nuevas entran siempre en "Espera de estudio" y el disparador "Estudiar …" aparece solo en los Disparadores del proyecto.
- **Pídeselo al asistente**: en el chat, el asistente muestra y activa, cambia o desactiva el cron job de las actualizaciones de cada app.
