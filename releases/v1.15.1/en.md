v1.15.1 — New updates reach the board again

### Fixes
- **New updates open on their own again**: since v1.11.0, the "Open each new update" schedule was being refused when it tried to open a new update, so it ended "ok" without creating the task. Updates found from 22 November onwards stayed as "new" and never went to study. The schedule can open them again; it only puts them in Waiting for study and never installs anything. Updates that were already stuck are not reopened by themselves: ask Jarvis to open them.
