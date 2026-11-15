# Frontend

`apps/frontend` — React 19, Vite, TypeScript and plain SCSS. No Tailwind, no state library,
no react-query: data lives in small hooks on top of axios.

## Layout

```
apps/frontend/src/
├── main.tsx            provider tree (Router → Theme → Alert → Navigation → Auth)
├── App.tsx             two routes: the public login page and everything else
├── Routes/             private routes and legacy redirects
├── Authentication/     route guards: Authentication_Check, Admin_Check, Guest_Check
├── Contexts/           Auth, Theme, Navs, Alert
├── Hooks/              one hook per resource, grouped by domain
├── Pages/
│   ├── Public/         login
│   └── Private/        Today, Services, Assistant (+ Workflow, Settings), Apps, Servers,
│                       Projects (board), Todos, Schedules, Docs, Health, Notifications,
│                       Help, Admin, Settings
├── Components/         shared UI (modals, inputs, buttons, charts, error boundary…)
├── Containers/         header and sidebar navigation
├── Service/            httpService (axios, withCredentials) and endPoints
├── Styles/             colours, mixins, fonts
├── Constants/          UI constants (some built on @myhomelab/shared)
├── config/             URLs and cookie helpers
└── i18n/               i18next setup and locales/<language>/<namespace>.json
```

Private pages render inside `Main`, which draws the sidebar and wraps the routes in an
error boundary, so a crash in one page shows a retry message instead of a blank app. Pages
that use ECharts (health dashboards) are lazy-loaded to keep the main bundle small.

## Talking to the API

- `Service/httpService.ts` is an axios instance with `baseURL` from `VITE_API_URL` and
  `withCredentials: true` (the session is an httpOnly cookie).
- `Service/endPoints.ts` mirrors every backend route. Add new routes there.
- In production the build uses `VITE_API_URL=/api`, so the frontend and API share an origin.

## Hooks

Hooks follow one simple shape — `useState`, an async `fetchX`, called from a `useEffect`,
with `try/catch` setting an error message:

```ts
export const useConnectedAccounts = (provider?: ConnectionProvider) => {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConnectedAccounts = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Endpoint(), { params: { provider } });
      setConnectedAccounts(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedAccounts();
  }, [provider]);

  return { connectedAccounts, loading, error, fetchConnectedAccounts };
};
```

Keep it that simple: no `useCallback`, no cancellation flags, no composite cache keys.

## Code style

- **No comments in frontend code** (`.ts`, `.tsx`, `.scss`). The code must read on its own,
  with clear names. Only directives stay (`eslint-disable`, `/// <reference>`).
- **Naming**: components and their files in `Pascal_Snake_Case`
  (`Email_Rule_Form_Modal.tsx`), a sibling `.scss` with the same name, CSS classes prefixed
  with the component (`.Email_row_expand_actions`), props types `Name_Props`, endpoints
  `Name_Endpoint`, hooks `useCamelCase`.
- Small files: split a component when it grows instead of adding sections.
- Colours come from the theme tokens in `Styles/Colors`; light and dark themes are both
  supported.

## Internationalisation

The interface ships in **pt-PT** (source), **en** and **es**, using i18next.

- Strings live in `src/i18n/locales/<language>/<namespace>.json`, one namespace per area
  (`common`, `nav`, `auth`, `ui`, `services`, `email`, `assistant`, `settings`, `admin`,
  `system`, `servers`, `notifications`, `help`, `health`, `docs`, `schedules`, `tasks`,
  `todos`, …).
- **The three files of a namespace always have the same keys.**
- **Never hard-code visible text in JSX.** Add a key in all three languages.
- In components: `const { t } = useTranslation('<ns>')`.
- Outside components: `i18n.t('<ns>:key')` (import from `src/i18n`).
- Dates: `toLocaleDateString(dateLocale())`.
- The language is chosen in Settings → Language and stored in the browser, like the theme.
- API error messages and assistant replies come from the backend in Portuguese; where the
  backend sends an error `code`, translate the code instead of showing the message.

## Lint and build

```bash
npm run lint             # from the root: backend + frontend
npm run build            # from the root: shared → backend → frontend
npm run dev:frontend     # Vite on http://localhost:5180 (strictPort)
```
