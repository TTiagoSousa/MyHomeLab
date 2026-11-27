# App updates

MyHomeLab tracks new versions of the connected apps (Forgejo, Nextcloud and its apps,
Home Assistant and its components, AdGuard Home, TREK, openGym, GamesTracker Vault, Immich, Paperless-ngx…) and of the Proxmox VE
hosts (including pending Debian packages), and handles each one as a task worked on by the
agents. The code lives in `apps/backend/src/app-update/` and the agent tools in
`apps/backend/src/assistant/toolsets/updates-tools.ts`.

> This is about updating *other* apps. Updating MyHomeLab itself is covered in
> [Deployment](../deployment.md#4-updating).

## Principles

- **The agent studies; the user decides.** The study never installs on its own: a
  recommendation (`next: recommend`) or a question (`next: waiting`) ends in *Waiting for
  reply*, and only the user moves the update to *Ready to update*.
- **The rules are documents.** What to check before and after, and how to install a given
  app, are rules in the user's documents (for example "<app> – rules", with
  `## Before updating`, `## After updating` and `## Never` sections). The code measures,
  runs and records.
- **Everything leaves a trail.** Each study, preparation and verification is an
  **attempt** with every point marked validated, not validated, not applicable or skipped,
  with evidence.
- **One at a time.** At most one update per user is installing or verifying at once; the
  others wait in the queue.

## States and board columns

Each opened update is a task in the user's **updates project**. The columns are found by
key, so they can be renamed freely.

| Status | Column |
|---|---|
| `NEW` | Todo |
| `STUDY` | Waiting for study |
| `STUDYING` | Study |
| `READY` | Ready to update |
| `WAITING` | Waiting for reply |
| `LATER` | Recheck later |
| `IN_PROGRESS` · `VERIFYING` · `DONE` · `FAILED` · `CANCELLED` | same names |

Moving a task on the board changes the update's status (and vice versa). The task's
"Yes, install", "Later" and "Cancel" buttons do the same.

## The flow

```
new version detected ──► available (no task yet)
                              │  the app's updates cron job (code, Todo or Waiting for study)
                              │  or an agent / the user: update_start
                              ▼
                       Waiting for study ──► Study ──► update_save_study
                                                          │
                     ┌────────────────────┬───────────────┴──────────┐
                     ▼                    ▼                          ▼
              Waiting for reply     Recheck later               Cancelled
              (recommendation)      (back to study on date)
                     │ user moves it / "Yes, install" / chat card
                     ▼
         Ready to update ──► installer picks it up (one per user)
                                     │ agent: update_prepare → update_check… → update_run
                                     ▼
                                In progress ──► Verifying ──► Done
                                     └──► Failed (snapshot restored)
```

1. **Detection.** Version checks create an *available* update with no task. The app's
   updates cron job (`updates.app`, plus `updates.ha_components` / `updates.nextcloud_apps`)
   puts it on the board in code: with "Put in a project" on, each available update goes to
   the chosen updates project, in Todo or Waiting for study; one whose app or component
   already has an open update waits for the next run. Otherwise an agent (guided by the
   general updates rules document) or the user opens it with `update_list_new` +
   `update_start`. From Waiting for study, the study runs through the normal study queue.
2. **Study.** A scheduler queues a "Study …" trigger for the agent that has
   `update_save_study`. The agent reads `update_release_notes` and
   `update_known_issues`, works through the study points with `update_check`, and saves a
   study (summary, risk, recommendation, reasons, sources, manual steps). A failed study is
   retried once after a delay; a second failure notifies the user.
3. **Decision.** The study never installs on its own (`next: install` is accepted only as an
   old name of `recommend`). A recommendation (`next: recommend`) or a question lands
   in *Waiting for reply* and shows under "Needs you" in Notifications; the user approves by
   moving it to *Ready to update*. Agents can only set `READY` through a
   chat card the user approves (`update_set_status install`); a board move by an agent is reverted.
4. **Install.** A scheduler picks ready updates (one per user, nothing else in progress) and
   asks the first active agent with `update_run` to install it. The agent calls
   `update_prepare` (opens the attempt with the "before" points and MyHomeLab's own
   measurements — disk and memory headroom and major-version jump), validates each
   point (fixing what the rules allow, e.g. taking a Proxmox backup of the CT/VM), then
   `update_run`: snapshot of the CT/VM, the update steps, a version check, and rollback to
   the snapshot on failure. A point that cannot be validated closes the attempt and puts
   the update back in *Waiting for reply* with a precise question. A Home Assistant component
   (add-on, HACS, firmware) has no steps or snapshot: the agent installs it through Home
   Assistant with `ha_update_install` (`install`, plus `check_config` and `restart` when the
   update asks for it), a narrow tool the infrastructure template has instead of the smart-home
   controls.
5. **Verify.** In `VERIFYING`, the agent checks the "after" points with `update_verify` and
   marks it `DONE`.

Each preparation opens a new attempt: an install that went back to *Waiting for reply* or
*Ready to update* closes its attempt (only an install paused while *In progress* continues the
same one). A newer version released during the study drops what was prepared (commands, spec):
the old study is refused and `update_run` refuses an attempt for another version. A study run
that fails before starting (no agent, no AI) counts as a failed attempt and waits 3 hours. On
restart: an install requested but not started goes to *Waiting for reply*, a verification is
resumed only once, and attempts still validating are stopped.

### Proxmox VE hosts

Host updates follow the same flow with differences: the commands run on the host itself,
there is **no snapshot and no automatic rollback** (a failure ends in `FAILED`), and a
reboot is always a separate step that needs the user's yes. Pending Debian packages
without a new Proxmox VE version become their own "system packages" update.

## Agent tools (updates toolset)

| Tool | Purpose |
|---|---|
| `updates_list`, `update_list_new`, `update_status` | Read updates and their state |
| `update_start` | Open an available update (creates the task, moves to study) |
| `update_release_notes`, `update_known_issues` | Research for the study |
| `update_save_study` | Save the study and choose the next state |
| `update_set_status`, `update_add_note` | Respond to the user, add notes |
| `update_check`, `update_attempt_close` | Mark attempt points; close a stuck attempt |
| `update_prepare`, `update_run`, `update_verify` | Prepare, install, verify |

## Developing

- Tests for the flow live next to the code (`app-update/*.spec.ts`); run `npm test`.
- When you add support for a new app, provide: version detection, release notes source,
  the install steps for the runner, and a starter rules document for the app.
