v1.17.0 — Updates only go on the board from the cron jobs, and nothing installs without your yes

### Changes
- **Updates come in only from the cron jobs you turn on**: the "When an update appears" trigger is gone, along with the "Updates waiting for a trigger" notice. A new version goes on the board only when the updates cron job of that app is on with "Put on the project", or when you open it yourself. In "Waiting for study", the study still starts on its own. Your existing "Open every new update" trigger is removed when you install this version.
- **Nothing installs without your yes**: after the study, an update always waits in "Waiting for reply" with the recommendation and the "Yes, install" button, even when the risk is low. It only moves to "Ready to update" when you say so.
