# apps/api

The minimal HTTP API layer (MVP Blueprint §2/§4/§7), exposing `AuthService` and `GoalService` over real HTTP so a real client (a future `apps/web` login flow, or anything else) can use them - the reason both domains stayed server-only rather than being called in-process like the earlier `apps/web` dev preview did.

Routes are versioned (`/api/v1/...`), errors come back as a consistent `{ error: { code, message, field? } }` envelope, and identity is a bearer token (`Authorization: Bearer <token>`) issued by `POST /api/v1/auth/login` - see ADR 0005 for why bearer tokens over cookies, and what's still deferred.

`apps/web` is **not** wired to this yet - it's a separate follow-up milestone.

## Run

```
npm install
npm run dev:api
```

Defaults to `http://localhost:4000`; override with `API_PORT`. CORS defaults to allowing `http://localhost:5173` (the `apps/web` dev server); override with `API_CORS_ORIGIN`.
