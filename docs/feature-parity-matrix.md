# Sanad Inventory — Laravel → React/Supabase Feature Parity Matrix

**Status:** foundation audit, branch `feat/supabase-clothing-transition`
**Scope:** what exists on each side today, what must be ported, and what has to
happen to data, auth and security before any cutover.

Two applications are in play:

| | Laravel (repo root) | React/Supabase (`apps/sanad-inventory-web`) |
|---|---|---|
| Serves | `sanadinventory.com` (production, VM) | `https://sanad-inventory.pages.dev` (Cloudflare Pages) |
| Data | MySQL `inventory_management_system`, single-tenant | Supabase Postgres, multi-tenant via `organizations` |
| Auth | Laravel session auth, `users.is_admin` | Supabase Auth (JWT) + `organization_members` |
| Status | **Production. Must not be disrupted.** | Prototype under active transition |

The Laravel application remains authoritative until an explicit, separately
agreed cutover. Nothing in this transition changes DNS, the VM, or the
production database.

---

## 1. Module-by-module parity

Legend: ✅ complete · 🟡 partial · ❌ absent · — not applicable

| Module | Laravel | React/Supabase | Verdict |
|---|---|---|---|
| **Authentication** | ✅ Session auth, login, logout, forgot-password with generic confirmation, self-registration disabled | 🟡 `signInWithPassword` + `AuthGuard`; no password reset, no sign-up, no MFA | Port reset flow |
| **User management** | ✅ Admin-only CRUD (`UserController`), `is_admin` gate, admin-created passwords stored as hashes | ❌ No user-management UI; membership rows must be inserted by hand | **Port — blocks onboarding** |
| **Organizations / tenancy** | ❌ Single-tenant, no org concept | ✅ `organizations`, `organization_members`, `org_role`, resolver + `OrgGate` (this branch) | React ahead |
| **Products (general)** | ✅ Full CRUD, search, categories, units, image upload, barcode/code, buying/selling price, quantity alerts, soft-delete Trash with restore + confirm-phrase permanent delete | ❌ `/products` renders 8 mock rows; no `products` table in Supabase | **Port — largest single gap** |
| **Clothing inventory** | ✅ `ClothingInventoryController`: list + stats by `inventory_status`, 4-step guided camera scan, AI field extraction, CSV export with UTF-8 BOM | ❌ Nothing | **Port — the stated objective** |
| **Lab assets** | ✅ CRUD, dashboard, scan interface (`LabAssetController`) | 🟡 List, detail, create; no edit, no delete, no lab-asset dashboard | Port edit/delete |
| **Photo scanning** | ✅ Session → upload → **queued** background job → complete; per-photo type prompts | 🟡 Session → upload → **synchronous** Edge Function → complete | Port queueing |
| **AI vision analysis** | ✅ **Real**: `OpenAIVisionService` (gpt-4o) behind a `VisionProvider` interface, with `MockVisionProvider` for tests; distinct prompt sets for lab assets and clothing | ❌ `scan-process` Edge Function returns deterministic mock JSON | **Port — highest-value gap** |
| **Missing components** | ✅ Detected, persisted, resolvable | 🟡 Detected and persisted; no resolve/dismiss UI | Port resolution UI |
| **Orders** | ✅ CRUD, order details, cart, invoice generation | ❌ "Coming soon" placeholder | Port |
| **Purchases** | ✅ CRUD, purchase details, approval | ❌ "Coming soon" placeholder | Port |
| **Quotations** | ✅ CRUD, quotation details | ❌ "Coming soon" placeholder | Port |
| **Customers / Suppliers** | ✅ Full CRUD | ❌ `/directory` placeholder | Port |
| **Categories / Units** | ✅ CRUD | 🟡 Tables + RLS exist and are seeded; no UI | Port UI |
| **Dashboard KPIs** | ✅ Live counts | ❌ Renders `mockData.kpis` | Port |
| **Activity history** | 🟡 Notifications table | ✅ `activity_log` with RLS, written on scan completion | React ahead |
| **Public API** | ✅ `GET /api/products` with whitelisted fields | — | Decide whether to preserve |
| **CSV export** | ✅ Clothing export, 23 columns, UTF-8 BOM for Arabic | ❌ | Port |
| **Branding / icons** | ✅ | ✅ Copied from root `public/icons/` | Parity |
| **Tests** | ✅ 69 tests, 209 assertions (per `CLAUDE.md`; not re-run for this branch — no PHP was touched, and PHPUnit is not installed in this checkout) | 🟡 32 tests (Vitest) covering the org resolver, session expiry and the test-environment Storage only; all other modules untested | Extend coverage as modules are ported |

---

## 2. Features that must be ported (ordered)

Ordering is by dependency, not by value: each slice unblocks the next.

1. **`products` table + RLS** — org-scoped, with the lab-asset columns folded in
   or split out. Everything below depends on it.
2. **Clothing domain model** — decide `specifications` jsonb vs. typed columns
   (see §3), then the list, stats, and guided scan flow.
3. **Real vision provider in `scan-process`** — port the prompt sets and the
   provider-interface pattern from `app/AI/`. The Laravel prompts are the
   specification; do not rewrite them from scratch.
4. **User + membership management UI** — currently the only way to onboard a
   user is manual SQL. This blocks every other user-facing slice.
5. **Products CRUD UI**, then Orders / Purchases / Quotations / Directory.
6. **CSV export** — must preserve the UTF-8 BOM; Arabic and accented text
   breaks in Excel without it.
7. **Test suite** — the React app has no tests at all. Port at least the
   equivalents of the Laravel deletion, auth and admin-gate tests.

---

## 3. Database / data migration requirements

| # | Issue | Detail | Required action |
|---|---|---|---|
| 1 | **No tenancy in source data** | Every Laravel row is implicitly single-tenant | Assign an `organization_id` to every migrated row. Requires a decision on which org (see Blockers). |
| 2 | **Key type change** | MySQL `bigint` auto-increment → Postgres `uuid` | Carry the legacy id in a `legacy_id` column so re-runs are idempotent and FKs can be rebuilt |
| 3 | **Prices are integer cents** | `Product::buyingPrice()` / `sellingPrice()` accessors divide/multiply by 100 | Migrate the **raw** column value; do not read through the accessor, or every price is off by 100× |
| 4 | **Clothing lives in JSON** | `products.specifications->inventory_mode = 'clothing'`, with `garment_type`, `department`, `brand`, `size_label`, `color`, `pattern`, `material`, `condition_notes`, `visible_flaws[]`, `measurements_cm{chest_width,length,waist,inseam}`, `inventory_status`, `storage_location` | MySQL `json` → Postgres `jsonb`. Decide: keep as jsonb (fast, flexible, weakly typed) or promote to typed columns (queryable, indexable, requires schema churn) |
| 5 | **Soft deletes** | `products.deleted_at` + Trash + confirm-phrase permanent delete | No Supabase equivalent exists. Add `deleted_at` **and** RLS/view filtering — a nullable column without a filter silently resurfaces trashed rows |
| 6 | **Product images on local disk** | `storage/products/`, served via `asset()` | Migrate to Supabase Storage; needs a new bucket and path-based RLS like `lab-asset-scans` |
| 7 | **Scan photos on local disk** | `storage/scans/{session_id}/` | Same; note the React path convention starts with `{organization_id}/` |
| 8 | **Enum divergence** | Laravel `asset_status` = `active/inactive/maintenance/disposed`; Supabase `asset_status` = `active/maintenance/inactive/disposed` — same members, different declared order | Values match, so migration is safe. Do not rely on ordinal position. |
| 9 | **Scan schema divergence** | Laravel `photo_scans` has `ocr_results`, `object_detection`, `classification_results`, `extracted_serial/model/manufacturer`, `file_size`, `dimensions`, `processing_time`; Supabase collapses these into one `extracted` jsonb | Either widen the Supabase table or define a lossless mapping into `extracted`. Decide before migrating scan history — or agree scan history is not migrated. |
| 10 | **Session type divergence** | Laravel `scanning_sessions.session_type` = `lab_asset`/`regular_product`, with clothing flagged in `device_info.inventory_mode`; Supabase `scan_type` = `intake`/`condition`/`missing` | These are orthogonal axes, not a renaming. Needs a mapping decision. |
| 11 | **Users → auth.users** | Passwords are Laravel bcrypt hashes | Supabase Auth can accept bcrypt hashes on import, but `username` has no Supabase equivalent and email becomes the sole identifier. Verify no user relies on username-only login. |

---

## 4. Authentication and security gaps

| # | Gap | Severity | Detail |
|---|---|---|---|
| 1 | **`org_role` is declared but never enforced** | **High** | Every RLS policy in `0001_initial.sql` / `0002_scans.sql` is a bare `is_org_member(organization_id)`. A `viewer` can insert, update and delete lab assets, scans and missing components exactly like an `owner`. The enum exists purely as a label. Fix before adding real users. |
| 2 | **No admin concept carried over** | **High** | Laravel gates user management on `users.is_admin`. Supabase has `owner`/`admin` in `org_role` but nothing reads them. The admin gate is lost in the port. |
| 3 | **`organization_members` has no write policies** | Medium | Only a `select` policy exists — inserts require the service role. Deliberate today, but membership management must be designed, not left to manual SQL. |
| 4 | **No password reset** | Medium | Laravel has a forgot-password flow with a deliberately generic confirmation. The React app has none. |
| 4b | ~~Sign-in errors leaked Supabase wording~~ | ~~Medium~~ | **Resolved.** `/login` reported `signInError.message` verbatim, distinguishing "user not found" from "wrong password" and so disclosing which emails are registered. Now a fixed generic string, matching Laravel `5857f61`. |
| 5 | **No self-registration guard by design** | Low | Laravel explicitly disabled self-registration. Supabase Auth allows sign-up **by default** — this must be turned off in project settings or the disabled-registration decision is silently reversed. **Verify in the dashboard.** |
| 6 | ~~Hardcoded `DEV_ORG_ID`~~ | ~~High~~ | **Resolved on this branch.** Replaced by the `organization_members`-derived resolver with no fallback. |
| 7 | ~~Unscoped reads~~ | ~~High~~ | **Resolved on this branch.** `listLabAssets()` and the detail panels relied on RLS alone, which returns the union of all a user's orgs. Now filtered by the active `organization_id`. |
| 8 | **Anon key is public by design** | Informational | `VITE_SUPABASE_ANON_KEY` ships in the client bundle. That is expected — it means **RLS is the only thing protecting the data**, which makes gap #1 more serious than it looks. |
| 9 | **Edge Function auth unverified** | Medium | `scan-process` is invoked with the user's JWT, but whether it verifies the caller's org membership before acting has not been audited. Do so before it does anything beyond returning mock JSON. |
| 10 | **No audit trail for auth events** | Low | `activity_log` records scans only. Laravel has no equivalent either, so this is a shared gap rather than a regression. |

---

## 5. What this branch changed

Foundation only — no clothing migration, no real AI, no deployment.

- Added `src/lib/org.ts`: `resolveCurrentOrgId()` / `resolveOrgState()`,
  membership cache keyed by user id, typed errors, auth-expiry classifier.
- Added `src/lib/orgContext.tsx` and `components/auth/OrgGate.tsx`: one screen
  per state (single org, multi-org picker, no membership, expired session).
- Removed `DEV_ORG_ID` entirely — the export is gone, not merely unused, so it
  cannot be re-imported.
- Scoped every lab-asset and scan read *and* write by the resolved
  organization, including the Storage path prefix that storage RLS parses.
- Updated the React README, which previously claimed no Supabase project and
  no Cloudflare deployment existed.

Follow-up correction slice (same branch):

- Session expiry is now distinguishable from a deliberate sign-out
  (`src/lib/authNotice.ts` + a `manualSignOutInFlight` flag in
  `session.tsx`). `/login` shows one fixed generic message; no Supabase, JWT
  or PostgREST text reaches the page. The attempted route, query string
  included, survives the redirect.
- Fixed three resolver defects found while reviewing for races: a double
  session read that could pair one user's memberships with another user's
  stored selection; `OrgGate` dropping the `from` location on redirect; and
  an error-path cache eviction that compared user ids instead of entry
  identity.
- Added a Vitest + jsdom + Testing Library suite (32 tests). **Mocked, not
  live** — RLS, real PostgREST behaviour and token refresh remain unverified.
- Test environment supplies its own WHATWG-conformant `localStorage` /
  `sessionStorage`. Node ≥ 22 ships hollow Web Storage globals that shadow
  jsdom's under Vitest; on Node 25 this failed all 22 tests. Verified on Node
  20, 22, 24 and 25.
