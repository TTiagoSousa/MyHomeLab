v1.10.0 — App backups removed

### Changes
- **App backups removed**: MyHomeLab no longer backs up connected apps. Most of those backups could not restore an app on their own (only its settings, or a list of what to rebuild), so the full backup of an app is now its own backup or the backup of its CT/VM in Proxmox. The backups card is gone from the app pages, and the app backups you had scheduled stop running. Files already saved in your destinations stay where they are.
- **MyHomeLab's own backup stays**: Admin → Backup works as before, with its destinations (Nextcloud or this server) in Apps → Backups.
- **Updates**: before updating an app, the rules now ask for a recent Proxmox backup of its CT/VM (taken by the Proxmox Operator if missing) and, where it helps, the app's own backup. Home Assistant parts are updated with Home Assistant's own backup (`backup: true`).
- **Agents**: `list_backups` and `run_backup` now cover only MyHomeLab's own backup and point apps to the Proxmox backup. The tools for the apps' own backups (Dispatcharr, Jellyfin, Vaultwarden, Immich) are unchanged.
