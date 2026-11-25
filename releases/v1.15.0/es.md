v1.15.0 — Los agentes ya no se cortan a los cinco minutos, los comentarios en las tareas cuentan como respuesta, y acceso por la API

### Mejoras
- **El trabajo largo ya no se corta**: cuando Jarvis pasaba trabajo a otro agente, o un agente hacía una copia o instalaba una actualización que tardaba más de cinco minutos, la llamada se cancelaba. Jarvis decía que la conexión se había cortado y el otro agente seguía solo, sin informe. Ahora ese trabajo llega hasta el final (hasta 20 minutos) y el informe vuelve.
- **Tus comentarios en una tarea son tus palabras**: lo que escribes en los comentarios de una tarea cuenta como si lo dijeras en el chat. Un "sí, borra el vzdump-… y actualiza" en los comentarios basta. Ya no necesitas abrir el chat. Los correos o páginas que el agente lee siguen sin contar nunca como tu sí.

### Novedades
- **Acceso por la API**: en Ajustes → Acceso por la API puedes crear tokens personales para usar MyHomeLab sin el navegador (por ejemplo, desde un script). Un token "Solo lectura" solo lee; uno "Completo" hace lo que tú haces en el sitio, pero no gestiona tokens, sesiones ni cuentas. El token aparece una vez, puede caducar y se revoca en la misma tarjeta.
