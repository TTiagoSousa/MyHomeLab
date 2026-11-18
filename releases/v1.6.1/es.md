v1.6.1 — Preguntas que ya no se pierden

### Correcciones
- **Asistente**: la pregunta se guarda en cuanto la envías. Cuando una petición tarda (Jarvis poniendo a varios agentes a trabajar) y un proxy delante de MyHomeLab corta la conexión, la página ya no da error: sigue esperando y muestra la respuesta en cuanto está lista. Si el equipo falla, la conversación muestra "No pude responder" con el motivo, en vez de que la pregunta desaparezca.
- **Ayuda**: temas nuevos para openGym, GamesTracker, Immich, Paperless, solidtime y la copia de MyHomeLab, y notas sobre ordenar los documentos con Jarvis y sobre las peticiones largas.

### Consejo
- Si MyHomeLab está detrás de Nginx Proxy Manager, sube su tiempo límite (Advanced: `proxy_read_timeout 15m; proxy_send_timeout 15m;`) para que las respuestas largas lleguen enseguida.
