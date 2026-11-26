v1.16.0 — Every app gets its own updates cron job

### Features
- **Updates cron job for every self-hosted app**: each app that MyHomeLab can check for a version now has a "Cron jobs" button with an "App updates" job. Home Assistant also gets one for its add-ons, HACS and firmware, and Nextcloud one for its Nextcloud apps. Pick how often it runs and, under Options, turn on "Put in a project", then choose the project and the column. In "Waiting for study" the study starts on its own and follows the usual path (it only installs with your yes). In "Todo" the task waits until you drag it. It runs in code, with no AI and no tokens, and also picks up the updates that were already waiting to be opened. If the same app or component already has an open update, the new one waits for the next run.

### Fixes
- **Health metric names**: the body composition metrics now use the usual names, such as "Body fat percentage", "Skeletal muscle mass" and "BMR", with their units.
