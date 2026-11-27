v1.18.0 — Updates that check out install on their own, and the assistant can turn on the updates cron jobs

### Changes
- **What checks out installs on its own**: after the study, if everything is right (nothing breaks for you and it can be rolled back), the update goes straight to "Ready to update" and installs. Anything missing with a safe fix, like a backup or some free space, is sorted out at the start of the install. A major jump, high risk, manual steps or a Proxmox update that is not low risk still wait in "Waiting for reply" for your yes.
- **Always "Waiting for study"**: in the updates cron job options you only choose the project. New versions always go into "Waiting for study", and the "Study …" trigger shows up on its own in the project's Triggers.
- **Ask the assistant**: in the chat, the assistant can show and turn on, change or turn off the updates cron job of each app.
