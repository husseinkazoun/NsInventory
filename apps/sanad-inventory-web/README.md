# Sanad Inventory — React/Vite Rebuild (Prototype)

This folder is the **React/Vite/TypeScript** rebuild of the Sanad Smart Inventory System.

The **Laravel 10 application at the repo root** (`/`) remains the **reference implementation** and is **not** affected by anything in this folder. You can keep running it alongside this prototype.

---

## What's here

A minimal, polished app shell that mirrors the Laravel dashboard's visual direction in a cleaner, more modern frame:

- React 18 + Vite 6 + TypeScript
- Tailwind CSS 3 with Sanad brand tokens
- React Router 6 (client-side routing)
- Lucide icons
- **Supabase backend** for auth, the lab-asset/scan domain, Storage and the `scan-process` Edge Function — a project is linked locally (`supabase/.temp/`, gitignored). No Laravel calls.
- **Deployed to Cloudflare Pages** at <https://sanad-inventory.pages.dev>. `sanadinventory.com` still points at the Laravel application; this deployment does not serve it.
- Mock data remains for the modules not yet ported (see "What is mocked")

### Routes

`/login` is public; everything else is wrapped in `AuthGuard` then `OrgGate` (both transparent in demo mode; session-gated and organization-gated in Supabase mode).

| Route | Status |
|---|---|
| `/login` | Sanad-branded sign-in surface (real `signInWithPassword` in Supabase mode; demo-mode notice when env unset) |
| `/dashboard` | Full visual: pretitle "Operations · Overview", title "Dashboard", Add Lab Asset CTA, Needs Attention / Inventory Pulse / Quick Actions sections, 8 KPI stat cards, 3 quick-action tiles (mock KPIs) |
| `/lab-assets` | Live in Supabase mode, mock fallback in demo mode; clickable rows route to detail |
| `/lab-assets/new` | Form-driven create; in Supabase mode redirects to detail page on success |
| `/lab-assets/:assetId` | Live read in Supabase mode; Inspection / Missing Components / Recent Activity panels still read from mock helpers (cutover planned) |
| `/scan/start` | 4-step Photo Scan flow (type → capture → review → done); real upload + Edge Function call in Supabase mode, hardcoded fixture in demo |
| `/products` | Mock table (8 rows) with search, category filter, low-stock segmented control, EmptyState |
| `/orders` | Placeholder card — "Coming soon" |
| `/purchases` | Placeholder card — "Coming soon" |
| `/quotations` | Placeholder card — "Coming soon" |
| `/directory` | Placeholder card — "Coming soon" |
| `/settings` | Placeholder card — "Coming soon" |

---

## How to run

From this directory:

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5174/>. The dev port is **5174** so it doesn't clash with the Laravel root Vite on 5173.

### Demo mode vs Supabase mode

The app boots in one of two modes depending on env vars:

| Mode | Trigger | Behaviour |
|---|---|---|
| **Demo** | `VITE_SUPABASE_URL` and/or `VITE_SUPABASE_ANON_KEY` unset | Mock data renders, `AuthGuard` and `OrgGate` are bypassed, header shows the placeholder "Admin" identity, the `/login` page surfaces a yellow "demo mode" notice. Used for offline previews and design reviews. |
| **Supabase** | Both env vars set | Routes are guarded by `AuthGuard` then `OrgGate`; unauthenticated visits redirect to `/login`. The header reflects the real signed-in profile, the active organization, and a sign-out button. This is the mode the Cloudflare Pages deployment runs in. |

To enable Supabase mode locally:

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

`.env.local` is gitignored.

### Cloudflare Pages

This app is deployed at <https://sanad-inventory.pages.dev>. The Pages project uses **root directory** `apps/sanad-inventory-web`, build command `npm run build`, output directory `dist`, and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set under Environment variables.

`sanadinventory.com` is **not** attached to this Pages project — that domain serves the Laravel application from the VM and is out of scope for the transition until an explicit cutover is agreed.

`public/_redirects` ships with the SPA fallback rule `/*  /index.html  200`. Vite copies it verbatim into `dist/_redirects` at build time, so Cloudflare Pages resolves deep-link refreshes (e.g. `/lab-assets/:id`, `/scan/start`) to the SPA shell out of the box — no extra `wrangler.toml` or `_routes.json` needed.

---

## Organization scoping (multi-tenancy)

Every organization-scoped read and write resolves its `organization_id` from the signed-in user's `organization_members` rows. There is **no development-org fallback** — an unresolved organization is an error, never a default.

- `src/lib/org.ts` — framework-free resolver. `resolveCurrentOrgId()` is what the query layer awaits; `resolveOrgState()` returns the same answer as data so the UI can render one screen per state. Memberships are cached per user id and dropped on any auth state change other than `TOKEN_REFRESHED`.
- `src/lib/orgContext.tsx` — `OrgProvider` / `useCurrentOrg()`. Reads the *same* module state, so the UI and the query layer can never disagree about the active tenant.
- `src/components/auth/OrgGate.tsx` — renders the app only once an organization is resolved.

| State | Behaviour |
|---|---|
| Exactly one organization | Resolved automatically; header shows its name as a plain label |
| Multiple organizations | Blocking picker; the choice persists in `localStorage` keyed by user id, and a header `<select>` switches tenant. Switching remounts the routed tree so data from the previous org is discarded. A stored id that is no longer a valid membership falls back to the picker, never to an arbitrary org. |
| No membership | Dedicated "No organization access" screen with a sign-out action — distinguishable from an org that is genuinely empty |
| Session expired | See "Session expiry" below |

Reads are filtered by `organization_id` **in addition to** RLS. RLS alone returns the union of every organization a user belongs to, which is wrong for a multi-org user — the UI shows one active tenant at a time.

### Session expiry

An expired credential and a deliberate sign-out both end as "no session", and supabase-js emits the same `SIGNED_OUT` event for each with no reason attached. Telling them apart takes an explicit signal:

1. `isAuthExpiryError()` classifies PostgREST `PGRST301`, HTTP 401 and JWT-expiry messages. `asAppError()` converts those into a typed `SessionExpiredError` and drops the local session (`scope: 'local'` — a server round trip would itself 401 on a dead token).
2. `SessionProvider`'s `SIGNED_OUT` handler is the **single** place that decides why the session ended. A `manualSignOutInFlight` flag, set only by `signOut()` and released in a `finally`, marks deliberate sign-outs. Anything else — including a background token refresh that fails while the tab is idle, which no query-layer code can observe — records the notice.
3. `authNotice.ts` holds that one-shot notice in `sessionStorage`, so it survives the hard reload that a boot-time refresh failure causes. It is cleared on read.
4. `AuthGuard` (and `OrgGate`, for the narrow window where it resolves first) redirects to `/login`, preserving the attempted destination *including its query string* in router state.
5. `/login` consumes the notice and shows a fixed generic string: **"Your session has expired. Please sign in again."** No Supabase, JWT or PostgREST text ever reaches the page.

Sign-in failures are also reported generically — the Supabase message distinguishes "user not found" from "wrong password", which discloses which emails are registered. This matches the Laravel app's generic login error (commit `5857f61`).

Other pages still render `error.message` from failed queries directly. For an expired session that message is the typed, generic one; other PostgREST failures can still surface raw text there. Narrowing that is not yet done.

---

## Authorization (role-based RLS)

`supabase/migrations/20260725161641_role_based_rls.sql` makes the database enforce the role matrix. Before it, every policy was a bare `is_org_member(organization_id)` — membership alone granted read, write *and* delete, so a `viewer` had exactly an `owner`'s rights and `org_role` was decorative.

| Role | Read org data | Create / update | Delete |
|---|:--:|:--:|:--:|
| `owner`  | ✅ | ✅ | ✅ |
| `admin`  | ✅ | ✅ | ✅ |
| `member` | ✅ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ |

Also enforced: `anon` gets nothing; no role reaches another organization; `activity_log` is append-only (no UPDATE/DELETE policy *or* privilege for anyone); organizations, profiles and memberships are read-only from the Data API.

**Helpers.** `public.is_org_member()` was `SECURITY DEFINER` in an exposed schema, so `anon` could call it at `/rest/v1/rpc`. It is dropped and replaced by four helpers in the unexposed `private` schema — `readable_org_ids()`, `writable_org_ids()`, `deletable_org_ids()`, `visible_profile_ids()` — each `security definer`, `set search_path = ''`, `EXECUTE` revoked from `PUBLIC`/`anon` and granted only to `authenticated`.

They return a **set of organization ids** rather than taking an id and returning boolean. That shape is what makes `organization_id in (select private.readable_org_ids())` an InitPlan evaluated once per statement. The old `is_org_member(organization_id)` took row data as an argument, so it necessarily ran per row — the `auth_rls_initplan` advisor warning. Wrapping the old form in a subselect would not have fixed it; the signature had to change.

**Cross-organization moves.** RLS cannot express column immutability — `WITH CHECK` sees only the new row, so a user belonging to two organizations could move a row between them and both states would satisfy the policy. A `BEFORE UPDATE` trigger (`private.forbid_org_change()`) enforces it for every role, `service_role` included.

**Grants.** The migration revokes all table privileges from `public`, `anon` and `authenticated`, then grants back exactly what the matrix needs. Exposure no longer depends on project-creation defaults.

Frontend role checks (`src/lib/permissions.ts`, `RequireWrite`) hide actions a role cannot perform. They are UX only — the database refuses the write either way.

### Staging

`supabase/staging/` is a reusable bootstrap package for a **separate** Supabase staging project: four fake role accounts created through the Auth Admin API, one clearly-named staging organization, minimal representative data, and a narrowly-scoped teardown. It is dry-run by default and refuses to run unless you name the target project explicitly and confirm intent.

```bash
npm run staging:bootstrap             # dry run
npm run staging:bootstrap -- --apply
npm run staging:teardown -- --apply
```

Full walkthrough — project creation, Auth settings, migration order, verification per role, advisor re-run — in [`supabase/staging/README.md`](./supabase/staging/README.md). The service-role key is read from the environment and never committed.

### Database tests

```bash
./supabase/tests/run.sh    # 92 assertions   (also: npm run test:db)
```

Stands up a throwaway Postgres 17 cluster, applies `00_supabase_bootstrap.sql` (local-only scaffolding for `auth.uid()`, `storage.objects` and the API roles) followed by the real migrations, then exercises the policies as `authenticated`/`anon` with a `request.jwt.claims` GUC — the same mechanism PostgREST uses. Docker is not required; a local Postgres server is (`brew install postgresql@17`). If none is found the script exits 2 and reports SKIP rather than passing.

Covered: anonymous denied · viewer read-only · member CRUD-minus-delete · admin and owner full CRUD · cross-organization isolation for every role · `organization_id` reassignment refused (including for a user who owns *both* organizations, the only case the trigger and not RLS catches) · membership/profile/organization mutation unavailable · activity log append-only · storage matching the matrix · revoked membership losing access immediately · plus 17 advisor-equivalent assertions.

## Tests

```bash
npm test          # vitest run
npm run test:watch
```

Vitest + jsdom + Testing Library. 95 tests across `src/lib/org.test.ts` (resolver), `src/lib/session.test.tsx` (expiry, notice, redirect), `src/lib/permissions.test.ts` (role capability matrix), `src/test/webStorage.test.ts` (Storage conformance) `supabase/staging/plan.test.mjs` (staging bootstrap plan and guards) and `supabase/staging/nodeVersion.test.mjs` (Node 22+ preflight, including real subprocess runs on an older runtime) and `src/pages/Login.test.tsx` (the first-sign-in redirect race). Vitest runs with `globals: false`, so tests import `describe`/`it`/`expect` explicitly and `tsc --noEmit` typechecks them with no extra ambient config; DOM cleanup is registered by hand in `src/test/setup.ts`.

Verified on Node 20.20.2, 22.22.1, 24.14.0 and 25.9.0.

### Node's built-in Web Storage

Node 22 introduced `localStorage` / `sessionStorage` globals; from Node 25 they are present by default. They are file-backed, and without a valid `--localstorage-file` Node still exposes the globals but they are hollow — `typeof localStorage.clear === 'undefined'`. Under Vitest's jsdom environment `window === globalThis`, so Node's global shadows jsdom's spec-compliant implementation and every test that touches storage fails with `window.localStorage.clear is not a function`.

`src/test/webStorage.ts` replaces those globals with a real implementation of the WHATWG Storage interface, but only when the existing one does not survive a set/get/remove round trip — so on Node 20, where jsdom's own Storage is used, nothing is touched. `src/test/webStorage.test.ts` asserts the conformance details the suite depends on: `getItem` returning `null` rather than `undefined`, key/value stringification, insertion-ordered `key(index)`, and `localStorage` being independent of `sessionStorage`.

> Node still prints ``Warning: `--localstorage-file` was provided without a valid path`` once per worker on Node ≥ 25. That is Node reporting that *its* storage is unusable — which is exactly why the replacement exists. It is expected and does not indicate a test failure.

> **These are mocked tests, not live verification.** `src/test/fakeSupabase.ts` replaces the Supabase client with a controllable fake. They exercise the resolver's and the session layer's own logic. They do **not** verify RLS policies, real PostgREST behaviour, real token refresh, or Storage — all of which still require a run against a live Supabase project. See "What is not yet verified live".

Covered: single org resolves automatically · multiple orgs require explicit selection · a valid saved selection is restored · a revoked saved org falls back to the picker · no membership yields the no-access state · expiry produces the generic notice · a deliberate sign-out does not · membership data cannot cross between users · the attempted route survives the redirect.

The suite was mutation-checked — each of these deliberate breakages causes failures, so the assertions are not passing vacuously: silently selecting the first org; accepting a stored org without validating membership; treating every sign-out as an expiry; dropping the query string from the preserved route; re-reading the session inside the membership fetch instead of using the resolved id; and, in the Storage replacement, a no-op `setItem`, a no-op `clear()`, or `getItem` returning `undefined` instead of `null`.

---

> **Setting up a new user is now a required step.** Because there is no development fallback, a freshly created Supabase user with no `organization_members` row sees the "No organization access" screen and no data — that is the resolver working, not a bug. Insert the `profiles` + `organization_members` rows as described at the bottom of [`supabase/seed.sql`](./supabase/seed.sql).

---

## Photo Scan flow

The `/scan/start` route walks through a 4-step intake or inspection workflow:

1. **Choose type** — `intake`, `condition`, or `missing`
2. **Capture** — pick an image via the file input (`accept="image/*"` opens the system camera on mobile)
3. **Review** — extracted JSON from the scan, including AI confidence and (for intake) a suggested asset record
4. **Done** — for intake, a `lab_assets` row is auto-created; for missing-component scans, findings persist to `missing_components`

In **demo mode** the file picker still works, but no upload happens and the review step shows a hardcoded fixture identical to what the Edge Function would return. The flow ends with the existing "Mock scan saved" notice.

In **Supabase mode** the flow:
- inserts a `scan_sessions` row when leaving step 1
- uploads the image to the `lab-asset-scans` bucket at `{org_id}/{scan_session_id}/{ts}-{rand}.{ext}` when leaving step 2
- inserts a `photo_scans` row pointing at that storage object
- calls the `scan-process` Edge Function with the image path and scan type
- writes the extracted JSON + confidence back onto the `photo_scans` row
- on completion, marks the session `completed`, creates `lab_assets` / `missing_components` rows as appropriate, and writes an `activity_log` row with `action='scanned'`

### Storage

| Bucket | Visibility | Path convention |
|---|---|---|
| `lab-asset-scans` | private (signed URLs only) | `{organization_id}/{scan_session_id}/{filename}` |

RLS on `storage.objects` parses the leading 36-character UUID via `public.scan_object_org(name)` and gates access through `is_org_member()`. The migration creates the bucket idempotently. If your environment forbids direct writes to `storage.buckets`, create the bucket via the Supabase dashboard with the same name and visibility, then re-run the migration; the policies will still install.

### Edge Function — `scan-process`

Source: `supabase/functions/scan-process/index.ts` (Deno; lives outside the React TS build).

It returns deterministic, fabricated JSON keyed by scan type — **no real AI provider is connected and no image is ever read**. Every successful response carries `simulated: true` and a `simulation_notice`, and the UI shows a persistent *"Simulated analysis — no image AI was used"* banner even when the call succeeds, so a working deployment is never mistaken for a working analysis.

Security, following the current Supabase "Securing Edge Functions" guidance:

- `createSupabaseContext(req, { auth: 'user' })` validates the caller's JWT and yields a client scoped to them, so **RLS enforces tenancy**. A service-role client is never used for authorization — with RLS bypassed, a cross-organization identifier would simply resolve and the check would pass.
- `verify_jwt = true` is pinned for this function in `config.toml`. Do **not** deploy with `--no-verify-jwt`.
- The handler verifies the `scan_sessions` and `photo_scans` rows exist and share one organization, that `image_path` names that same organization *and* session, and that any `lab_asset_id` belongs to it. Role must be `owner`, `admin` or `member`; **`viewer` gets 403**.
- `scan_type`, UUIDs, `image_path` shape and body size are strictly validated; every rejection returns one generic message that names no field or value.
- CORS is an allowlist (`ALLOWED_ORIGINS`, defaulting to local + the Pages origin) with `Vary: Origin`; an unlisted origin receives no `Access-Control-Allow-Origin`.
- Nothing is logged — no tokens, image bytes, or identifiers.

`handler.ts` holds the logic and takes its dependencies as arguments, so `deno test supabase/functions/scan-process/handler_test.ts` runs 31 tests without a server or network. `index.ts` is the thin entry that supplies the real context factory.

Deploy when ready:

```bash
supabase functions deploy scan-process
```

If the function is **unreachable** at runtime, the React app falls back to the same offline payload and says so. A **401 or 403 is never converted into a fallback** — a refusal is a real answer, and showing fabricated results would tell the user their scan succeeded when the server declined it. Only genuine unavailability (network failure, 5xx) uses the fallback.

### What's still mocked after this commit

- Dashboard KPIs (`mockData.kpis`)
- Products / Orders / Purchases / Quotations / Directory / Settings pages
- `LabAssetDetail` Inspection / Missing Components / Recent Activity panels (writes happen in Supabase mode, but the panels keep reading from `mockData` until a later commit wires them to real tables)
- No real AI vision provider

### Other scripts

```bash
npm run build       # type-check then build to ./dist
npm run preview     # serve the build locally for verification
npm run typecheck   # tsc --noEmit only
```

---

## What is mocked

What's in `src/lib/mockData.ts` with typed records:

- Dashboard KPI counts (`kpis`) — pure mock, no live source yet
- 8 product rows — used by `/products` until a real `products` table lands
- 5 lab asset rows — used as the demo-mode fallback for the live `lab_assets` queries
- Per-asset Inspection / Missing Components / Recent Activity records — used by `/lab-assets/:assetId` panels until those panels are wired to the real `photo_scans`, `missing_components`, and `activity_log` tables

Even in Supabase mode some of the above still renders from mock data (notably the Dashboard KPIs and the Lab Asset detail panels) — see "What is intentionally NOT wired yet" below for what's pending.

---

## What is intentionally NOT wired yet

Phase 2 brought a real Supabase backend online in code; provisioning, the rest of the modules, and the real AI are still to come.

**In code, already in place:**
- Supabase client + session/auth shell (`src/lib/supabaseClient.ts`, `src/lib/session.tsx`, `src/components/auth/AuthGuard.tsx`)
- Real `signInWithPassword` login surface (`src/pages/Login.tsx`)
- Migrations for the lab-assets and scans domain: `lab_assets`, `scan_sessions`, `photo_scans`, `missing_components`, `activity_log`, plus the `organizations` / `profiles` / `organization_members` skeleton, all with RLS gated by `is_org_member()`
- Storage bucket `lab-asset-scans` with path-based RLS via `scan_object_org(name)`
- `scan-process` Edge Function (Deno) returning deterministic mock JSON keyed by scan type
- Cloudflare Pages SPA fallback via `public/_redirects`

- Current-organization resolver (`src/lib/org.ts` + `src/lib/orgContext.tsx` + `components/auth/OrgGate.tsx`) — organization scope comes from the signed-in user's `organization_members` rows, with no development fallback

**Already deployed:**
- A Supabase project **is** linked (locally, via `supabase/.temp/linked-project.json`, which is gitignored — the project ref is deliberately not committed). Migrations, seed, Storage bucket and the `scan-process` function target it.
- A Cloudflare Pages project **is** live at <https://sanad-inventory.pages.dev>, built from `apps/sanad-inventory-web` with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in the Pages environment.
- `sanadinventory.com` is **not** served by this app — it still resolves to the Laravel application on the VM, and this transition must not change that.

**Not yet:**
- Dashboard KPIs still render from `mockData.kpis`; the Lab Asset detail panels (Inspection / Missing / Activity) read live tables but the KPI header does not
- Products / Orders / Purchases / Quotations / Directory / Settings pages are still mock-only or placeholder
- The Laravel clothing workflow (`products.specifications->inventory_mode = 'clothing'`) has no Supabase equivalent yet — see [`docs/feature-parity-matrix.md`](../../docs/feature-parity-matrix.md)
- The `scan-process` Edge Function still returns deterministic mock JSON — no real vision provider (OpenAI / Anthropic Claude Vision / Gemini) is wired
- No CI/CD, no i18n, no state-management library beyond React local state + URL params. Tests now exist for the organization resolver and session-expiry handling only (see "Tests"); every other module is untested.

### Live verification status

Read-only verification was run against the linked Supabase project on 2026-07-25 via `supabase db query --linked` and direct PostgREST calls. No data, policy, user or remote setting was modified.

**Verified live:**

| Claim | Evidence |
|---|---|
| Migrations are applied | All 10 tables present, `relrowsecurity = true` on every one |
| The resolver's membership query works under RLS | Simulated the real user (`set local role authenticated` + `request.jwt.claims`); the `organization_members ⋈ organizations` join returned the row. `is_org_member()` does not recurse — previously an assumption, now proven |
| The `organizations!inner` PostgREST embed resolves | The exact select string from `org.ts` returns HTTP 200. Control: a bogus relationship returns HTTP 400 `PGRST200`, so the 200 is meaningful |
| RLS denies `anon` | Same embed as `anon` returns `[]`, not rows — despite `anon` holding table-level DML grants |
| `isAuthExpiryError()` matches reality | A malformed and an expired/badly-signed JWT both return **HTTP 401 with `code: "PGRST301"`**. Neither message contains "expired", which is why the classifier keys off the code, not message text |
| Storage is provisioned | Bucket `lab-asset-scans` exists and is private, with all four `storage.objects` policies |
| `scan_object_org()` parses the app's path convention | Returns the org UUID for `{org}/{session}/{file}` and `null` for a non-UUID prefix |
| `scan-process` is deployed | ACTIVE, version 2 |
| Tables are exposed to the Data API | `anon`/`authenticated`/`service_role` hold full DML grants. The project predates the 2026-05-30 opt-in change, so no explicit `GRANT`s were needed — see the caveat below |

**Still not verified live:**

- That a background token-refresh failure emits `SIGNED_OUT` rather than another event. This is client-side supabase-js behaviour and cannot be observed from the database.
- An actual authenticated Storage upload under the `{organization_id}/…` path. The bucket, policies and path parser are confirmed, but performing an upload would write data.
- The app running end-to-end in Supabase mode — there is still no `.env.local`.

> **Data API caveat.** Nothing in the migrations grants anything; the tables are reachable only because this project predates Supabase's switch to opt-in Data API exposure (changelog 2026-04-28, default for projects created after 2026-05-30 — this project was created 2026-05-18, an 11-day margin). If the project is ever recreated, every table becomes invisible to the client with a symptom that looks nothing like a grants problem. Add explicit `GRANT`s in the RLS slice.

---

## Brand assets

`./public/icons/` is a **copy** of the canonical brand assets at the repo root's `/public/icons/`. If those are regenerated upstream (`scripts/build-icons.py`), re-copy them here.

Brand tokens live in `tailwind.config.ts`:

| Token | Hex | Use |
|---|---|---|
| `ns-navy` | `#0B1A33` | Brand text, page titles, big numbers |
| `ns-navy-soft` | `#1E2A4A` | Section labels |
| `ns-blue` | `#1a72e8` | Primary actions, links, active states |
| `ns-blue-tint` | `#E8F0FE` | Active nav capsule, hover surfaces |
| `ns-border-soft` | `#E5E7EB` | Card borders, dividers |
| `ns-cyan` | `#00D4F5` | Logo accent (used in the inventory tile mark) |
| `ns-cyan-light` | `#7AE8F8` | Logo top-right glow |

---

## Project structure

```
apps/sanad-inventory-web/
├── public/
│   ├── icons/                       ← copied brand assets
│   └── _redirects                   ← Cloudflare Pages SPA fallback
├── src/
│   ├── main.tsx                     ← entry, mounts <App /> in <BrowserRouter> + <SessionProvider>
│   ├── App.tsx                      ← renders <AppRoutes />
│   ├── routes.tsx                   ← React Router routes (public /login + AuthGuard'd shell)
│   ├── styles/globals.css           ← Tailwind + brand utility classes
│   ├── lib/
│   │   ├── mockData.ts              ← typed KPIs, products, lab assets, panel fixtures
│   │   ├── format.ts                ← Intl number / relative date
│   │   ├── supabaseClient.ts        ← singleton Supabase client (null in demo mode) + currentUserId()
│   │   ├── session.tsx              ← <SessionProvider> + useSession() + signOut()
│   │   ├── org.ts                   ← current-organization resolver + typed errors + auth-expiry classifier
│   │   ├── orgContext.tsx           ← <OrgProvider> + useCurrentOrg() over the same module state
│   │   └── queries/
│   │       ├── labAssets.ts         ← listLabAssets / getLabAsset / createLabAsset (mock fallback)
│   │       └── scans.ts             ← startScanSession / uploadScanPhoto / processScanPhoto /
│   │                                   completeScanSession (mock fallback + offline-mock recovery)
│   ├── components/
│   │   ├── auth/AuthGuard.tsx       ← demo-mode bypass, Supabase-mode session gate
│   │   ├── auth/OrgGate.tsx         ← org picker / no-membership / expired-session screens
│   │   ├── brand/BrandMark.tsx
│   │   ├── layout/{AppShell,AppShellLayout,Header,Sidebar}.tsx
│   │   └── ui/{Badge,Button,EmptyState,PageHeader,QuickActionTile,SectionTitle,StatCard}.tsx
│   └── pages/                       ← one component per route (Login, Dashboard,
│                                       LabAssets, LabAssetDetail, LabAssetNew, ScanStart,
│                                       Products, Orders, Purchases, Quotations,
│                                       Directory, Settings)
├── supabase/
│   ├── config.toml                  ← local Supabase CLI project config
│   ├── seed.sql                     ← idempotent dev seed mirroring mockData 1:1
│   ├── migrations/
│   │   ├── 0001_initial.sql         ← org / profiles / categories / units / lab_assets / activity_log + RLS
│   │   └── 0002_scans.sql           ← scan_sessions / photo_scans / missing_components + storage RLS
│   └── functions/scan-process/      ← Deno Edge Function (deterministic mock JSON for now)
└── tailwind.config.ts / vite.config.ts / tsconfig*.json
```

---

## Where the Laravel reference lives

At the repo root: `/`. The current Laravel dashboard's look (commit `4539edf`, Phase 1B) is what this prototype is calibrated to — calmer severity palette, navy hierarchy, section groupings.
