# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Each release also has its notes, in English,
Portuguese and Spanish, in [`releases/`](./releases).

<!-- The release script (npm run release -- --prepare) adds new versions below this line. -->

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
