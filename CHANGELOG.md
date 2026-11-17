# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Each release also has its notes, in English,
Portuguese and Spanish, in [`releases/`](./releases).

<!-- The release script (npm run release -- --prepare) adds new versions below this line. -->

## [1.5.0] — 2026-11-17

### Features
- **docs**: agents see the Documents page as the user does and propose its arrangement; approving applies links, tags, title and section


## [1.4.0] — 2026-11-17

### Features
- **backup**: MyHomeLab backups as a password-protected zip with one folder per area, restored table by table without pg_dump


## [1.3.0] — 2026-11-17

### Features
- **backup**: full encrypted MyHomeLab backups with schedules, a local destination and restore from the app or the CT
- **projects**: tidier board with a filters panel, hidden empty columns and several fixes

### Fixes
- **deploy**: restart PostgreSQL after an OOM kill and start it before dumps


## [1.2.0] — 2026-11-17

### Features
- **gametracker**: connect GamesTracker Vault with shelf tools, backups, version checks and a Games Curator agent
- **opengym**: direct MCP with Claude Code via an API token, MyHomeLab tools with the Claude API
- **trek**: direct MCP with Claude Code, MyHomeLab TREK tools with the Claude API
- **ai**: choose between Claude Code and the Claude API
- **docs**: generated maps, user sections and sub-documents


## [1.1.2] — 2026-11-16

### Fixes
- **email-rule**: release conversations already stuck in the inbox by your own replies


## [1.1.1] — 2026-11-16

### Fixes
- **email-rule**: archive the whole thread when only your own messages are left in the inbox


## [1.1.0] — 2026-11-16

### Features
- **docs**: rules, maps and history with doc sets, merges and a read-before-acting gate


## [1.0.0] — 2026-11-15

First public release of MyHomeLab.

### Features

- Self-hosted control panel for a Proxmox home lab, installed as a single LXC container with an in-app updater and automatic rollback.
- Jarvis and a team of AI agents (Claude) with tools, prompts and rules kept in the database and edited in the app.
- Rules as documents that the agents read before acting, with proposals you approve.
- App updates as tasks: study, approval, install with a snapshot, verification and rollback — for server apps, Home Assistant parts, Nextcloud apps and the Proxmox host.
- Project board, personal tasks and notifications for every alert and every question from the agents.
- Proxmox servers, SMART disk health, watched services, backups, email rules (Gmail, Outlook, IMAP), Nextcloud → Google Tasks sync and Huawei Health import.
- Integrations with Home Assistant, AdGuard Home, Nextcloud, Forgejo, TREK and openGym.
- Android app, and the interface in Portuguese, English and Spanish.

[1.0.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.0.0
[1.1.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.1.0
[1.1.1]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.1.1
[1.1.2]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.1.2
[1.2.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.2.0
[1.3.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.3.0
[1.4.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.4.0
[1.5.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.5.0
