# apps/api

The minimal HTTP API layer (MVP Blueprint §2/§4/§7), exposing `AuthService` and `GoalService` over real HTTP so a real client (a future `apps/web` login flow, or anything else) can use them - the reason both domains stayed server-only rather than being called in-process like the earlier `apps/web` dev preview did.

Routes are versioned (`/api/v1/...`), errors come back as a consistent `{ error: { code, message, field? } }` envelope, and identity is a bearer token (`Authorization: Bearer <token>`) issued by `POST /api/v1/auth/login` - see ADR 0005 for why bearer tokens over cookies, and what's still deferred.

`apps/web` is a real client of this API (see `apps/web/README.md`).

Data is durable across restarts via file-backed repositories (ADR 0016) - see the repo-root `RUNNING.md` for the full local setup, environment, and data-reset guide. Quick version:

```
npm install
cp ../../.env.example ../../.env   # from apps/api, or just `cp .env.example .env` from the repo root
npm run dev:api                    # from the repo root
```

Defaults to `http://localhost:4000`; override with `API_PORT` in `.env`. CORS defaults to allowing `http://localhost:5173` (the `apps/web` dev server); override with `API_CORS_ORIGIN`. Data defaults to `Apps/api/data/`; override with `DATA_DIR`. `.env` is loaded automatically (Node's native `--env-file-if-exists`, no `dotenv` dependency) - no `.env` file is required, every variable has a working default.
