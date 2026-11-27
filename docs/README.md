# MyHomeLab documentation

MyHomeLab is a self-hosted control panel for a home lab: your services, Proxmox servers,
watched services and alerts, Gmail organisation, personal tasks, a project board, health
data — and **Jarvis**, a team of AI agents (built on Anthropic's Claude) that can read and
act on all of it, from the web app or the Android app.

This folder is the public documentation. Start with the architecture overview, then pick the
guide you need.

## Overview

| Document | What it covers |
|---|---|
| [Architecture](./architecture.md) | Monorepo layout, backend layers, the agent team, docs-as-rules, app updates, board, notifications, i18n |
| [HTTP API](./api.md) | Every route, grouped by module, with auth and role notes |
| [Deployment](./deployment.md) | Installing and updating on Proxmox (LXC, no Docker), the in-app updater, reverse proxy |

## Development

| # | Guide | What it covers |
|---|---|---|
| 01 | [Getting started](./development/01-getting-started.md) | Prerequisites, install, environment, ports, running locally |
| 02 | [Backend](./development/02-backend.md) | NestJS modules, the four layers, DTOs, schedulers, adding a module |
| 03 | [Frontend](./development/03-frontend.md) | React structure, hooks, styling, i18n rules |
| 04 | [Database](./development/04-database.md) | Prisma schema, migrations, `migrate diff` |
| 05 | [Agents and tools](./development/05-agents-and-tools.md) | How agents run, toolsets, permissions, adding a tool |
| 06 | [App updates](./development/06-app-updates.md) | The update workflow: available → study → install (or approval) → verify |
| 07 | [Mobile](./development/07-mobile.md) | The Android app (React Native + Expo) and its APK |
| 08 | [Testing](./development/08-testing.md) | Jest in the backend, lint, CI jobs |
| 09 | [Releases](./development/09-releases.md) | Versioning, release notes, branch flow, tagging |

## Quick answers

- **How do I install it?** → [Deployment](./deployment.md).
- **How do I run it locally?** → [Getting started](./development/01-getting-started.md).
- **Which route do I call?** → [HTTP API](./api.md).
- **Where does new backend code go?** → [Backend](./development/02-backend.md).
- **How do I give an agent a new ability?** → [Agents and tools](./development/05-agents-and-tools.md).
- **How do I cut a release?** → [Releases](./development/09-releases.md).
