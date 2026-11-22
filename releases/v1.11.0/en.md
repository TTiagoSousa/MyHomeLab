v1.11.0 — Approvals in the chat, TP-Link routers and many fixes

### New
- **TP-Link routers and extenders**: connect TP-Link Archer routers and RE extenders to see the status, Wi-Fi, devices, DHCP, port forwards and access control, with agent tools. If someone else takes the router session, MyHomeLab reconnects every 5 minutes.
- **Approve in the chat**: sending emails, changing the team, installing updates and doc proposals now show a card in the chat with "Yes" and "No". You can also just ask Jarvis.
- **Updates on their own**: agents install small, safe updates by themselves and ask you only about the important ones (major versions, high risk, manual steps or the Proxmox host). At the end they tell you what they did.
- **Home Assistant**: the Infrastructure Engineer can now update Home Assistant.
- **Mobile site**: on small screens the menu becomes a drawer.

### Fixes
- **Security**: sessions are checked against the database, account secrets are no longer returned by the API, logins are throttled per client IP, SSH host keys are checked on first use, the LXC scripts and nginx headers are stricter, and `postgres_query` stays read-only.
- **Agents**: runs without you only use a safe list of tools, text from emails and web pages is treated as data and not as orders, and the prompts are shorter and cached, so each request costs less. Fixed an error 400 when the chat had pending cards or proposals.
- **Updates and alerts**: studies, installs and disk alerts no longer get stuck or repeat, an interrupted update is no longer marked as installed, and updating MyHomeLab waits while apps are installing or runs are going.
- **Email rules**: REGEX rules now match, and when Google revokes access the account is disconnected with a "Reconnect" notice instead of failing silently.
- **Apps**: connection errors show the real cause (certificate, closed port, name not found), times are no longer off by one hour in summer, and changing a token no longer fails in AdGuard, Forgejo, Home Assistant, Nextcloud and TREK. More fixes in AdGuard, Forgejo, NPM, Nextcloud, Drive, TP-Link, ClickHouse and Coolify.
- **Site**: switching chat or server no longer shows data from the previous one, an expired session goes back to login and then to the same page, and the first load is about half the size.
