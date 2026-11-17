v1.3.0 — Copias completas de MyHomeLab y un tablero de Proyectos más ordenado

### Novedades
- **Copia de seguridad de MyHomeLab**: en Admin → Copia de seguridad creas una copia de todo — documentos y los enlaces entre ellos, agentes, tareas, servicios, servidores, apps conectadas con sus accesos — en un archivo cifrado con tu contraseña de copias. Descárgala, o prográmala hacia Nextcloud o hacia una carpeta del propio servidor (el nuevo destino "Este servidor"). Se restaura desde la app o con `myhomelab-restore` en el servidor, con vuelta atrás automática si algo falla.
- **Proyectos**: el tablero está más limpio — los filtros pasaron a un botón "Filtros", las columnas vacías se ocultan por defecto, la descripción del proyecto está en un (i), la Lista empieza con Done y Cancelled cerrados y "Borrar tarea" está en el panel de propiedades.

### Correcciones
- **Proyectos**: las acciones en bloque ya no cambian tareas ocultas por los filtros; el filtro de etiquetas, la búsqueda con Atrás/Adelante y el título vacío de una tarea vuelven a funcionar bien; la pestaña del navegador dice "MyHomeLab".
- **Servidor**: si el PostgreSQL muere por falta de memoria, vuelve a arrancar solo, y las copias diarias y la de las actualizaciones ya no fallan por encontrarlo parado.
