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
- **Static, typed mock data only** — no backend, no Laravel calls, no Cloudflare yet

### Routes

`/login` is public; everything else is wrapped in `AuthGuard` (transparent in demo mode, real session-gated in Supabase mode).

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
| **Demo** | `VITE_SUPABASE_URL` and/or `VITE_SUPABASE_ANON_KEY` unset | Mock data renders, `AuthGuard` is bypassed, header shows the placeholder "Admin" identity, the `/login` page surfaces a yellow "demo mode" notice. Used for offline previews and design reviews. |
| **Supabase** | Both env vars set | Routes are guarded by `AuthGuard`; unauthenticated visits redirect to `/login`. The header reflects the real signed-in profile and adds a sign-out button. |

To enable Supabase mode locally:

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

`.env.local` is gitignored.

### Cloudflare Pages note

`public/_redirects` ships with the SPA fallback rule `/*  /index.html  200`. Vite copies it verbatim into `dist/_redirects` at build time, so Cloudflare Pages resolves deep-link refreshes (e.g. `/lab-assets/:id`, `/scan/start`) to the SPA shell out of the box — no extra `wrangler.toml` or `_routes.json` needed.

When wiring the Pages project, set its **root directory** to `apps/sanad-inventory-web`, build command to `npm run build`, output directory to `dist`, and add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` under Environment variables.

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

Right now it returns deterministic mock JSON keyed by scan type — **no real AI provider is connected**. The TODO at the top of the file marks where to plug in a vision provider (OpenAI / Anthropic Claude Vision / Gemini / etc.).

Deploy when ready:

```bash
supabase functions deploy scan-process
```

If the function is **unreachable** at runtime, the React app falls back to the same offline-mock payload and surfaces a yellow "Using offline mock" banner above the review results. The `photo_scans` row is marked `failed` with the error message so the issue is traceable.

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

**Not yet:**
- No live Supabase project is provisioned — the migrations and seed are ready to run, but no `<project-ref>` has been linked. Demo mode is the only mode that runs today.
- No Cloudflare Pages project, no DNS for `sanadinventory.com`
- Dashboard KPIs still render from `mockData.kpis`; the Lab Asset detail panels (Inspection / Missing / Activity) still read from mock helpers
- Products / Orders / Purchases / Quotations / Directory / Settings pages are still mock-only or placeholder
- `DEV_ORG_ID` is hardcoded in `queries/labAssets.ts` and `queries/scans.ts` — to be replaced with a `useCurrentOrg()` hook reading from `organization_members`
- The `scan-process` Edge Function still returns deterministic mock JSON — no real vision provider (OpenAI / Anthropic Claude Vision / Gemini) is wired
- No CI/CD, no tests (planned for a later phase), no i18n, no state-management library beyond React local state + URL params

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
│   │   └── queries/
│   │       ├── labAssets.ts         ← listLabAssets / getLabAsset / createLabAsset (mock fallback)
│   │       └── scans.ts             ← startScanSession / uploadScanPhoto / processScanPhoto /
│   │                                   completeScanSession (mock fallback + offline-mock recovery)
│   ├── components/
│   │   ├── auth/AuthGuard.tsx       ← demo-mode bypass, Supabase-mode session gate
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
