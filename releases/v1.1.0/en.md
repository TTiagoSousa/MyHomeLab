v1.1.0 — Clearer docs: rules, maps and history

### Features
- Docs now come in three kinds: rules (how to act), maps (what exists and where) and history (what happened). Custom doc types are gone.
- The Docs page has two tabs, Documents and History. Documents are grouped into general, servers and apps, and projects. History shows the last 90 days and can show older entries.
- Servers and updatable apps without docs get "+ Rules" and "+ Map" buttons.
- Before an agent acts, it gets the list of docs that match the request (by link, title or tags) and must read them first. The "required" flag is gone.
- Proposals can merge docs: approving one creates the new doc with its tags and removes the docs it replaces. The proposal text is collapsed by default.
- Starter docs: a generic set with five process docs, plus doc sets from `templates/docs`, the example set and community sets published on GitHub.
- Update tasks read each app's single "rules" doc instead of separate study and install docs.

### Fixes
- Disconnected accounts no longer show up on the Docs page or in doc suggestions.
