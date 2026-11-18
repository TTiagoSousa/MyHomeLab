v1.8.1 — Service failures that close themselves

### Fixes
- **Service failures on the board**: when a monitored service went down, its task stayed in Todo after the service came back, waiting for an agent to close it (and if the agent had no board access, it never did). Now, when the service answers again, MyHomeLab notes how long it was down and moves the task to Verifying; once it has been stable for 10 minutes, it closes the task as Done. If the task is waiting for your reply (or someone moved it), it is left as it is.
- **Failures during an update**: while an app (or the server's Proxmox) is being updated, the service going down for a few minutes no longer opens a failure task — it is noted on the update's task instead. The notification still opens and closes by itself.
