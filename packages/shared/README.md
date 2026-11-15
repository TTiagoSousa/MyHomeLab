# @myhomelab/shared

Types and constants used by both the backend and the frontend — for example the run
frequencies of email rules and task sync (`RUN_FREQUENCIES`, `RUN_FREQUENCY_INTERVAL_MS`).

Built to both CommonJS (for NestJS) and ESM (for Vite):

```bash
npm run build:shared           # from the repository root
```

The root `dev` and `build` scripts build it first. If you change it with the backend
stopped, run `build:shared` again.
