v1.7.0 — Claude Code and the API, side by side

### Features
- **Mixed mode** (Settings → AI, needs the Anthropic API key): choose the engine for each kind of work — chat with Jarvis, update studies, installs and checks, scheduled runs, and subagents. By default light work (chat and studies) goes through the API and long work stays in Claude Code with your subscription. Apps with an MCP server (TREK, openGym) use it with both engines.
- **Claude Code jobs at once**: each Claude Code job starts processes that use hundreds of MB, so now only a set number run at the same time (Settings → AI, 1 to 6, 2 by default) and the others wait their turn. It applies outside Mixed mode too.

### Fixes
- **Memory and restarts**: an update study interrupted by a restart went straight back to the queue, so a study that ran out of memory kept the backend restarting about every 15 minutes (slow pages, Jarvis stopping mid-answer). It now counts as a failed attempt and tries again only once, 3 hours later. When memory runs out, the kernel now stops one Claude Code process instead of the whole backend: only that request fails, with the reason, and the rest of the site keeps working.

### Tip
- With several agents at once, 2 GB of RAM is tight for the container: 4 GB is recommended (Proxmox → the CT → Resources → Memory).
