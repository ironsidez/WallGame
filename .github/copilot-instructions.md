# GitHub Copilot Instructions — WallGame

You are working in the **WallGame** monorepo: a browser-based, grid/pixel RTS with a **Node/Express + Socket.io** backend and a **React + TypeScript (Vite)** frontend.

## 🚦 Source of truth (read first)
- **Game rules, entities, UI flows:** `docs/GAME_DESIGN_SPEC.md` (treat as canonical)
- **System shape & scaling roadmap:** `docs/ARCHITECTURE.md`
- **HTTP + WebSocket contract:** `docs/API.md`
- **Local setup / env:** `docs/DEVELOPMENT.md` + `packages/server/.env.example`

If a requested change is not described in the design spec, prefer to **propose a spec update first** (or explicitly call out the mismatch and implement only what’s already specified).

---

## 🗂️ Repo layout (monorepo workspaces)
- `packages/client` — React + TS (Vite), canvas rendering (grid), Zustand stores, Socket.io client
- `packages/server` — Node + TS (ESM), Express routes, Socket.io server, PostgreSQL (`pg`), security + Winston logging
- `packages/shared` — cross-cutting types and helpers (position keys, distances, logger factory)
- `tests` — Playwright E2E (Page Object Model) + rich artifacts
- `logs` — server-side log files (generated at runtime)

Prefer **reusing existing modules/patterns** over introducing new systems.

---

## ✅ How Copilot should deliver changes
When asked to implement a feature/fix/refactor, respond with:
1. **Plan (1–5 steps)** and any assumptions
2. **Target files** (exact paths)
3. **Minimal patch** (smallest coherent change-set)
4. **How to verify** (commands + what artifacts/logs to inspect)

Avoid “big bang” rewrites. Keep PRs focused.

---

## 🧠 Domain & gameplay rules
- This is an RTS with a **persistent grid-based map** and server-authoritative state.
- Keep mechanics consistent with *entity-first* definitions in `docs/GAME_DESIGN_SPEC.md`.
- If you add or change an entity property/action/rule, update the spec (and any relevant reference tables).

---

## 🔁 Contracts: keep server/client/shared in sync
### Shared types/helpers are preferred
- Put cross-package types in `packages/shared/src/types.ts`
- Put cross-package utility logic in `packages/shared/src/game-logic.ts`
- Avoid duplicate helpers/constants across client/server (e.g., position-to-key logic).

### Socket + API compatibility
- Socket event names/payloads must match usage in:
  - server: `packages/server/src/socket/socketHandlers.ts`
  - client: `packages/client/src/stores/gameStore.ts` and UI components
  - docs: `docs/API.md` (update it when behavior changes)

### Serialization matters
`GameState` contains `Map`s and other non-JSON-native structures.
- When sending state over Socket.io, follow the existing `serializeGameState(...)` pattern.
- If you add new fields to state, **explicitly include them** in serialization/deserialization paths.

---

## 🗄️ Database / SQL expectations
- The canonical schema is `database/setup.sql`. Treat it as **source of truth** for tables/constraints/indexes.
- Avoid ad-hoc schema drift:
  - If code changes require schema changes, update `database/setup.sql` **and** any server DB access code/types that depend on it.
  - Prefer additive, backwards-compatible changes when possible (new columns with defaults, new tables, new indexes).
- Be explicit about correctness:
  - Add/verify constraints (PK/FK/UNIQUE/CHECK) when they encode game rules.
  - Add indexes for frequently queried fields, but don’t add speculative indexes without evidence.
- Keep DB ↔ API ↔ shared types in sync:
  - If a DB column changes meaning/name/type, update `packages/shared` types and server queries, and update `docs/API.md` if payloads are affected.
- When debugging persistence issues, consult `logs/database.log` and `logs/error.log` and reference the exact error/query lines.

### 🚫 No migration frameworks
- Do **not** introduce or suggest migration tooling (Prisma/Knex/TypeORM/MikroORM/Flyway/etc.).
- Do **not** create `migrations/` folders or “generate a migration” steps.
- All schema evolution happens by **editing `database/setup.sql` directly** (and updating dependent queries/types/docs).
- If a change would normally be expressed as a migration, instead:
  1) update `database/setup.sql`,
  2) update server queries + `packages/shared` types,
  3) update docs (API/spec) if payloads change,
  4) verify via Playwright and check `logs/database.log`.

---

## 🧩 Coding conventions & quality bar
### TypeScript
- Assume **strict** typing; avoid `any`.
- If you must accept unknown data (network/DB), narrow it quickly with checks.
- Prefer `import type { ... }` for type-only imports when appropriate.

### Formatting & code style (match the package)
- **Client (`packages/client`)**: follow the existing React/Vite style (hooks, minimal semicolons, single quotes).
- **Server/Shared (`packages/server`, `packages/shared`)**: follow the existing Node/TS style (semicolons are common, single quotes).
- Prefer small, readable functions and descriptive names over clever one-liners.

### React (client)
- Use function components + hooks.
- Prevent expensive rerenders in the canvas/grid loop:
  - do heavy work outside render
  - memoize derived data
  - redraw only the viewport
- Prefer stable selectors for tests (`data-testid`) over brittle CSS/text selectors.

### Node/Express/Socket.io (server)
- Validate inputs at boundaries; return consistent error shapes.
- Enforce auth/authorization server-side (never trust the client).
- Prefer structured logs using the repo’s logger utilities (below).

---

## 🪵 Logging & security
### Use the project loggers (don’t invent new ones)
- Server: import from `packages/server/src/utils/logger.ts`
  - `serverLogger`, `dbLogger`, `createLogger(...)`
- Shared logger supports runtime injection; server injects Winston at startup.
- Avoid `console.log` in production paths (ok for quick local debugging / scripts).

### Check logs during debugging
After running the app or tests, inspect the **runtime logs**:
- `logs/server.log`
- `logs/database.log`
- `logs/combined.log`
- `logs/error.log`
- When explaining behavior or regressions, **base conclusions on evidence** from `tests/test-results/<timestamp>/...` and `logs/*.log` (reference the exact files you used).

### Never leak secrets
- Do not log raw JWTs/passwords.
- Use masking helpers (e.g., `packages/server/src/utils/security.ts` and test masking utilities).

---

## 🧪 Testing is required after changes
### The “golden path” (acceptance)
Run Playwright via the root test runner:
```bash
npm test
```
Notes:
- `npm test` runs `tests/run-tests.js`, which sets a single timestamp and launches Playwright.
- Playwright auto-starts/reuses dev servers via `playwright.config.js`.

### Useful unit test commands
Run package-level unit tests when relevant:
```bash
npm test --workspace=@wallgame/server
npm test --workspace=@wallgame/shared
npm test --workspace=@wallgame/client
```

### Build/typecheck sanity
```bash
npm run build
```

### Where to look after tests
Artifacts are written under:
- `tests/test-results/<timestamp>/summary.txt`
- `tests/test-results/<timestamp>/test-results.json`
- `tests/test-results/<timestamp>/html-report/`
- `tests/test-results/<timestamp>/screenshots/`
- plus traces/videos on failure (see Playwright config output directory)

When considering “what happened”, use:
- Playwright artifacts (**especially screenshots + summary + JSON**)
- server log files under `logs/`

### Test setup expectations
- E2E tests load credentials from `packages/server/.env.local` (see `tests/setup/test-env.js`).
- Prefer adding/maintaining tests using the existing Page Object Model in `tests/pages/`.

### Fix failures the right way
- Don’t “fix” tests by weakening assertions unless the spec/contract truly changed.
- Use artifacts + logs to find the root cause and correct the behavior.

---

## 📝 Docs discipline
If your change affects behavior visible to players or API consumers, update docs alongside code:
- Gameplay/behaviors/entities: `docs/GAME_DESIGN_SPEC.md`
- REST/WebSocket contract: `docs/API.md`
- System behavior or constraints: `docs/ARCHITECTURE.md`
- Setup/scripts/env: `docs/DEVELOPMENT.md` and/or `packages/server/.env.example`

---

## ⚡ Performance & scalability reminders
- Assume maps can be large: avoid O(width×height) work on every tick or render.
- Prefer diffs/incremental updates over full-state transmission.
- Avoid blocking the Node event loop with heavy synchronous work; batch or async where possible.

---

## ✅ Definition of done (for any change)
- Compiles/builds cleanly (`npm run build`)
- Relevant unit tests pass (workspace tests as appropriate)
- Playwright acceptance suite passes (`npm test`)
- Reviewed artifacts in `tests/test-results/<timestamp>/...` when behavior is in question
- Checked `logs/*.log` for warnings/errors/regressions
- Updated docs/spec if external behavior changed
