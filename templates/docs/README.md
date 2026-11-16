# Document templates

Sets of ready-made documents that anyone can add to their MyHomeLab in
**Documents → Create suggested documents**. The app reads this folder from the installed
version and also checks [`index.json` on `main`](./index.json), so new community sets show up
without an update.

## Add a set

1. Create a folder `templates/docs/<your-set-id>/` with one Markdown file per document.
2. Start each file with a front matter block:

   ```markdown
   ---
   title: Home Assistant – rules
   kind: RULES            # RULES (what may be done and how) or MAP (what exists)
   tags: [home assistant, update]
   summary: One line for the agents' index.
   apps: [HOME_ASSISTANT] # optional: linked to each connected app of these providers
   agents: [infra]        # optional: linked to these agents (by key)
   server: true           # optional: linked to the first Proxmox server
   ---
   # Home Assistant – rules
   …
   ```

   A document that names `apps` is only created when one of those apps is connected.
   Providers: `GMAIL`, `OUTLOOK`, `IMAP`, `NEXTCLOUD`, `FORGEJO`, `TREK`, `HOME_ASSISTANT`,
   `ADGUARD`, `GOOGLE_TASKS`, `OPENGYM`.
3. Add the set to [`index.json`](./index.json) with an `id`, `author`, `language`, a
   `name` and `description` in `pt-PT`, `en` and `es`, and the list of `files`.
4. Open a pull request against `develop`.

**Never** put personal data in a template: domains, IP addresses, e-mail addresses, names,
tokens or passwords. Use `example.com`, `192.168.1.x` and placeholders such as `<CT>`.
