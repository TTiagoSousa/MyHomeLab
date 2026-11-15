# @myhomelab/frontend

The MyHomeLab web app — **React 19**, **Vite**, **TypeScript**, plain **SCSS** (the "Jarvis"
HUD theme, day and night) and **i18next** (Portuguese, English, Spanish).

## Run it

From the repository root:

```bash
npm install
npm run dev:frontend           # http://localhost:5180
```

`apps/frontend/.env.local` points it at the API:

```
VITE_API_URL=http://localhost:3100
```

In the container the app is built with `VITE_API_URL=/api` and served by nginx next to the
API.

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (port 5180, `strictPort`) |
| `npm run build` | type-check and build into `dist/` |
| `npm run lint` | ESLint |

## Structure

```
src/
  Pages/Private/     one folder per page (Services, Assistant, Email, Servers, Notifications,
                     Addons, Settings, Help, Admin…)
  Components/        shared components and modals
  Hooks/             one hook per resource (useServers, useServiceMonitors, useTelegram…)
  Containers/        sidebar and navigation
  Service/           axios instance and the list of API endpoints
  i18n/locales/      <language>/<namespace>.json
  Styles/            colour tokens, fonts and mixins
```

## Conventions

- **No comments in the code** (`.ts`, `.tsx`, `.scss`) — clear names instead. Only lint and
  reference directives stay.
- Hooks follow one shape: `useState`, a plain async `fetchX` called from a `useEffect`, and a
  `try/catch` that turns the API error into a message.
- No visible text in JSX — every string is an i18n key, added in all three languages
  (`pt-PT` is the source).
- Components and their styles live side by side (`Name/Name.tsx` + `Name/Name.scss`).
