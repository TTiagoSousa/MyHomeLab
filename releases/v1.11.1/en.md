v1.11.1 — Stuck backup notices and updates

### Fixes
- **Backup notices**: failure notices from the app backups (removed in v1.10.0) could never close and could not be dismissed. They now close by themselves when MyHomeLab starts. MyHomeLab's own backup still warns as before.
- **Updates**: installing Claude Code during an update now has a 5-minute limit. If npm hangs, the update shows a warning and carries on instead of getting stuck on "Installing Claude Code…".
