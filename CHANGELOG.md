# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/). Each release also has its notes, in English,
Portuguese and Spanish, in [`releases/`](./releases).

<!-- The release script (npm run release -- --prepare) adds new versions below this line. -->

## [1.19.0] — 2026-11-27

### Features
- **cron-job**: let daily cron jobs run at a chosen Lisbon time


## [1.18.0] — 2026-11-27

### Features
- **app-update**: install studied updates on their own when everything checks out, keep the updates cron job column fixed on Waiting for study, and let the assistant turn the updates cron jobs on


## [1.17.0] — 2026-11-27

### Features
- **app-update**: drop the new-update trigger so only enabled updates cron jobs reach the board, and never install without the user's yes


## [1.16.0] — 2026-11-26

### Features
- **app-update**: add an updates cron job to every self-hosted app that puts new versions straight on the board, in Todo or Waiting for study

### Fixes
- **health**: rename the body composition metrics to the usual names


## [1.15.1] — 2026-11-26

### Fixes
- **agent**: let unattended schedules open new updates so they reach the board again


## [1.15.0] — 2026-11-25

### Features
- **agent**: keep long tool calls alive past five minutes, treat the user's task comments as their own words, and add personal API tokens with read or full scope


## [1.14.0] — 2026-11-24

### Features
- **health**: add BMI and fat, muscle, skeletal muscle, bone, water and protein mass and percentage pages, join a value to an existing measurement, list or grid quick forms with field order, and a devices page with kinds, brand, model and a default per kind used by weigh-ins and vital readings


## [1.13.0] — 2026-11-24

### Features
- **health**: add a page per body composition and tape measurement with its own logging, scale devices with a default, quick forms, choosable average tabs with a carousel, a conditions page and a vitals page, and form and coffee shortcuts on Today


## [1.12.0] — 2026-11-23

### Features
- **today**: add weather from the city chosen in settings and shortcuts to connected apps, email rules and links


## [1.11.1] — 2026-11-23

### Fixes
- **backup**: close failure notices of the removed app backups on startup and time out the Claude Code install so updates cannot hang


## [1.11.0] — 2026-11-22

### Features
- **agents**: approve emails, team changes and installs with chat cards, limit unattended runs to a safe allowlist, mark external text as data, keep postgres_query read-only, reserve agent keys, bound schedules to the team, let agents install safe updates on their own and add migration:new, CI lint, pinned actions and foreign key indexes
- **tplink-router**: connect TP-Link Archer routers and RE extenders with status, Wi-Fi, devices, DHCP, port forwards, access control and agent tools, reconnecting every 5 minutes when the session is taken, and approve doc proposals from the chat with a card or by asking Jarvis

### Fixes
- **audit**: stop stuck and repeated update, study and disk alert flows, block MyHomeLab updates while work runs, dedupe notices with an advisory lock, show real connection errors, disable revoked Google accounts, fix regex rules, Lisbon times and token changes, add the ha_update_install tool and agent tool migration, cache prompts, fix system notes mid-conversation, add the mobile drawer, stale-response guards, lazy routes and per-language loading
- **security**: reject OAuth state tokens as sessions and check sessions against the database, stop returning account secrets, throttle logins per client IP behind trusted proxies, verify SSH host keys on first use, harden the LXC scripts run by root, add nginx security headers and tighten GCM tags, regex rules and read-only commands


## [1.10.0] — 2026-11-20

### Changes
- **backup**: connected apps no longer have backups in MyHomeLab; only MyHomeLab's own backup remains, and update rules and agents point to the Proxmox CT backup


## [1.9.0] — 2026-11-20

### Features
- **apps**: connect Plane, Gitea Mirror, Jellyfin, Dispatcharr, Coolify, Nginx Proxy Manager, ClickHouse, PostgreSQL, Vaultwarden and Infisical with agent tools, version checks and backups, and use the Gitea Mirror and Coolify MCP servers
- **assistant**: read PDF, Word and Excel files sent in the chat, connect Google Drive and Sheets with project-linked write access, and let Jarvis create projects and folders and format sheets


## [1.8.1] — 2026-11-18

### Fixes
- **service-monitor**: move a service failure task to Verifying when the service is back and close it once stable, and open no task while that app is being updated


## [1.8.0] — 2026-11-18

### Features
- **stirling**: connect Stirling-PDF with an API key, run any of its operations on Paperless and Nextcloud files, change its settings, back them up, check versions and use its MCP when enabled
- **disk-alert**: Proxmox disk almost full alert as a server cron job, with board tasks, notifications and an agent that studies and fixes within the user's limits
- **cron-job**: app cron jobs run in code without AI, with a Cron jobs page per account and AdGuard jobs to refresh the blocklists and allowlists

### Fixes
- **solidtime**: route the solidtime pages to their own paths instead of the Paperless ones


## [1.7.0] — 2026-11-18

### Features
- **ai**: mixed mode that picks Claude Code or the Claude API per kind of work, with subagents on the delegation provider and a per-user limit of Claude Code jobs at once

### Fixes
- **agents**: count a study interrupted by a restart as a failed attempt, let the kernel kill a Claude Code process before the backend, and keep the service up when one is OOM-killed


## [1.6.1] — 2026-11-18

### Fixes
- **assistant**: save the question as soon as it arrives, record failed replies, and wait for the reply when a proxy cuts a long request; help topics for the new apps and the MyHomeLab backup


## [1.6.0] — 2026-11-17

### Features
- **solidtime**: connect solidtime with a personal token, with timer, time entry, report and catalogue tools, organisation export backups and a Timekeeper agent; official colour logos for the app icons
- **paperless**: connect Paperless-ngx with an API token, with document search, filing, bulk edit, metadata and settings tools, backups, version checks and an Archivist agent
- **immich**: connect Immich with an API key, with photo, album, people, queue and settings tools, database backups, version checks and a Photo Curator agent


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
[1.6.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.6.0
[1.6.1]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.6.1
[1.7.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.7.0
[1.8.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.8.0
[1.8.1]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.8.1
[1.9.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.9.0
[1.10.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.10.0
[1.11.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.11.0
[1.11.1]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.11.1
[1.12.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.12.0
[1.13.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.13.0
[1.14.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.14.0
[1.15.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.15.0
[1.15.1]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.15.1
[1.16.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.16.0
[1.17.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.17.0
[1.18.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.18.0
[1.19.0]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/v1.19.0
