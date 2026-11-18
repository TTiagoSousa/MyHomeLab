v1.6.1 — No more lost questions

### Fixes
- **Assistant**: a question is saved as soon as you send it. When a request takes long (Jarvis putting several agents to work) and a reverse proxy in front of MyHomeLab cuts the connection, the page no longer shows an error: it keeps waiting and shows the reply as soon as it is ready. If the team fails, the conversation shows "I could not answer" with the reason, instead of the question disappearing.
- **Help**: new topics for openGym, GamesTracker, Immich, Paperless, solidtime and the MyHomeLab backup, and notes on tidying documents with Jarvis and on long requests.

### Tip
- If MyHomeLab sits behind Nginx Proxy Manager, raise its read timeout (Advanced: `proxy_read_timeout 15m; proxy_send_timeout 15m;`) so long replies arrive straight away.
