v1.6.0 — Photos, documents and hours

### Features
- **Immich**: connect your photo library with an API key. The new Photo Curator agent finds photos (also by description, like "beach at sunset"), organises albums, names people, shows duplicates, and looks after the server — job queues, a database backup now, and settings, always showing what changes before it applies. It never deletes photos. Backups save the Immich database; version alerts included.
- **Paperless-ngx**: connect your scanned documents with an API token. The new Archivist agent searches the full text, reads a document to answer questions ("how much did I pay?"), files documents one at a time or many at once (with confirmation), creates tags, correspondents and types that match new documents automatically, shows failed tasks and changes the configuration (before → after, with confirmation). It never deletes documents. Backups save the organisation and configuration as JSON; version alerts included.
- **solidtime**: connect your time tracking with a personal token. The new Timekeeper agent starts and stops the timer, logs forgotten hours in your own time zone, changes entries (showing the old one), sums hours by day, project or client, and creates projects, clients, tasks and tags. Backups save the full organisation export.
- **App icons**: every connected app now shows its official logo in its brand colours.
- Each new app has a Connections page listing the API calls MyHomeLab makes and whether your token or role allows them.

### Fixes
- **Agents**: the Photo Curator had a colour the Workflow page could not show.
