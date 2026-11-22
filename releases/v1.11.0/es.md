v1.11.0 — Aprobaciones en el chat, routers TP-Link y muchas correcciones

### Novedades
- **Routers y repetidores TP-Link**: conecta routers TP-Link Archer y repetidores RE para ver el estado, el Wi-Fi, los dispositivos, el DHCP, las redirecciones de puertos y el control de acceso, con herramientas para los agentes. Si otra persona se queda con la sesión del router, MyHomeLab vuelve a conectarse cada 5 minutos.
- **Aprobar en el chat**: enviar emails, cambiar el equipo, instalar actualizaciones y las propuestas de documentos muestran ahora una tarjeta en el chat con "Sí" y "No". También puedes pedírselo a Jarvis.
- **Actualizaciones solas**: los agentes instalan solos las actualizaciones pequeñas y seguras y solo te preguntan por las importantes (versiones grandes, riesgo alto, pasos manuales o el host Proxmox). Al final te dicen lo que hicieron.
- **Home Assistant**: el Ingeniero de Infraestructura ya puede actualizar Home Assistant.
- **Web en el móvil**: en pantallas pequeñas el menú pasa a ser un cajón.

### Correcciones
- **Seguridad**: las sesiones se comprueban en la base de datos, la API deja de devolver los secretos de las cuentas, los inicios de sesión tienen límite por IP, las claves SSH de los servidores se verifican en la primera conexión, los scripts del LXC y las cabeceras de nginx son más estrictos y `postgres_query` queda en solo lectura.
- **Agentes**: cuando se ejecutan sin ti solo usan una lista segura de herramientas, el texto de emails y páginas se trata como datos y no como órdenes, y los prompts son más cortos y van en caché, así que cada petición cuesta menos. Corregido un error 400 cuando el chat tenía tarjetas o propuestas pendientes.
- **Actualizaciones y alertas**: los estudios, las instalaciones y los avisos de disco ya no se quedan atascados ni se repiten, una actualización interrumpida ya no queda como instalada y actualizar MyHomeLab espera mientras hay apps instalándose o ejecuciones en curso.
- **Reglas de email**: las reglas con REGEX ya funcionan y, cuando Google retira el acceso, la cuenta se desconecta con un aviso "Volver a conectar", en lugar de fallar en silencio.
- **Apps**: los errores de conexión dicen la causa real (certificado, puerto cerrado, nombre no encontrado), las horas ya no salen una hora desfasadas en verano y cambiar el token ya no falla en AdGuard, Forgejo, Home Assistant, Nextcloud y TREK. Más correcciones en AdGuard, Forgejo, NPM, Nextcloud, Drive, TP-Link, ClickHouse y Coolify.
- **Web**: al cambiar de conversación o de servidor ya no aparecen datos del anterior, una sesión caducada vuelve al inicio de sesión y luego a la misma página, y la primera carga ocupa cerca de la mitad.
