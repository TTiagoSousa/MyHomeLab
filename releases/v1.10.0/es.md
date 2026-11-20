v1.10.0 — Se quitan las copias de las apps

### Cambios
- **Se quitan las copias de las apps**: MyHomeLab deja de hacer copias de seguridad de las apps conectadas. La mayoría de esas copias no bastaba para restaurar la app por sí sola (solo los ajustes, o una lista de lo que rehacer), así que la copia completa de una app pasa a ser la de la propia app o la de su CT/VM en Proxmox. La tarjeta de copias sale de las páginas de las apps y las copias de apps que tenías programadas dejan de ejecutarse. Los archivos que ya están en tus destinos se quedan allí.
- **La copia del propio MyHomeLab se queda**: Admin → Copia de seguridad funciona como antes, con sus destinos (Nextcloud o este servidor) en Apps conectadas → Copias.
- **Actualizaciones**: antes de actualizar una app, las reglas piden ahora una copia reciente de su CT/VM en Proxmox (el Operador Proxmox la hace si falta) y, donde ayuda, la copia de la propia app. Las piezas de Home Assistant se actualizan con la copia del propio Home Assistant (`backup: true`).
- **Agentes**: `list_backups` y `run_backup` pasan a cubrir solo la copia de MyHomeLab y mandan las apps a la copia de Proxmox. Las herramientas de las copias propias de las apps (Dispatcharr, Jellyfin, Vaultwarden, Immich) no cambian.
