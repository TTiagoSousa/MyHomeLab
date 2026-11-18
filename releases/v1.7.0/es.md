v1.7.0 — Claude Code y la API, lado a lado

### Novedades
- **Modo Mixto** (Ajustes → IA, necesita la clave de la API de Anthropic): eliges el motor de cada tipo de trabajo — la conversación con Jarvis, los estudios de actualizaciones, las instalaciones y verificaciones, las ejecuciones programadas y los subagentes. Por defecto, lo ligero (la conversación y los estudios) va por la API y lo largo se queda en Claude Code, con tu suscripción. Las apps con MCP (TREK, openGym) lo usan con los dos motores.
- **Trabajos a la vez en Claude Code**: cada trabajo en Claude Code lanza procesos que gastan cientos de MB, así que ahora solo corre un número fijo a la vez (Ajustes → IA, de 1 a 6, por defecto 2) y los demás esperan su turno. Vale también fuera del modo Mixto.

### Correcciones
- **Memoria y reinicios**: un estudio de actualización interrumpido por un reinicio volvía enseguida a la cola, y un estudio que agotaba la memoria dejaba el backend reiniciándose más o menos cada 15 minutos (páginas lentas, Jarvis parando a mitad). Ahora cuenta como intento fallido y solo vuelve a intentarlo una vez, 3 horas después. Cuando se acaba la memoria, el kernel detiene un proceso de Claude Code en lugar del backend entero: solo falla esa petición, con el motivo, y el resto del sitio sigue funcionando.

### Consejo
- Con varios agentes a la vez, 2 GB de RAM es poco para el contenedor: se recomiendan 4 GB (Proxmox → el CT → Resources → Memory).
