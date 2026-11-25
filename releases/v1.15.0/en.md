v1.15.0 — Agents no longer cut off after five minutes, task comments count as your answer, and API access

### Improvements
- **Long work is no longer cut off**: when Jarvis passed work to another agent, or an agent made a backup or installed an update that took more than five minutes, the call was cancelled. Jarvis said the connection was cut while the other agent kept working on its own, with no report. Now that work runs to the end (up to 20 minutes) and the report comes back.
- **Your comments on a task are your words**: what you write in a task's comments now counts as if you had said it in the chat. A "yes, delete vzdump-… and update" in the comments is enough. You no longer have to open the chat. Emails or pages the agent reads still never count as your yes.

### New
- **API access**: in Settings → API access you can create personal tokens to use MyHomeLab without the browser (for example, from a script). A "Read only" token only reads; a "Full" token does what you do on the site, but cannot manage tokens, sessions or accounts. The token is shown once, can expire and is revoked from the same card.
