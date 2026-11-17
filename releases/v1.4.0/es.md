v1.4.0 — Copias de MyHomeLab en una carpeta por área

### Novedades
- **Copia de seguridad de MyHomeLab**: la copia pasa a ser un .zip con contraseña que se abre como una carpeta, con una subcarpeta por área — agentes, documentos, proyectos, tareas, apps conectadas, IA, servidores, servicios, email, salud y el resto. Cada tabla va entera en un archivo, los documentos y los prompts de los agentes van también en Markdown para leer, y en _restauro/ quedan las claves que leen los accesos. Se abre con 7-Zip, WinRAR o un Mac.
- **Restaurar**: la restauración lee esas mismas carpetas, tabla por tabla, y ya no necesita pg_dump. Sigue desde la app (Admin → Copia de seguridad → Restaurar una copia) o con `myhomelab-restore <copia.zip>` en el servidor, con vuelta atrás automática si algo falla.
