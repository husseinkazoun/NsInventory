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

| Route | Status |
|---|---|
| `/dashboard` | Full visual: pretitle "Operations · Overview", title "Dashboard", Add Lab Asset CTA, Needs Attention / Inventory Pulse / Quick Actions sections, 8 KPI stat cards, 3 quick-action tiles |
| `/lab-assets` | Mock table (5 rows) with status badge styling |
| `/products` | Mock table (5 rows) with low-stock highlighting |
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

### Other scripts

```bash
npm run build       # type-check then build to ./dist
npm run preview     # serve the build locally for verification
npm run typecheck   # tsc --noEmit only
```

---

## What is mocked

- KPI counts on the dashboard (`src/lib/mockData.ts` → `kpis`)
- 5 product rows
- 5 lab asset rows
- No real auth, no real data, no real API calls

Everything is in `src/lib/mockData.ts` with typed records — swap to API calls when the backend lands.

---

## What is intentionally NOT wired yet

- No backend / API
- No database
- No authentication
- No Cloudflare deployment, no DNS, no production config
- No CI/CD
- No tests yet (planned for a later phase)
- No internationalization
- No state management library (React local state + URL is enough for this prototype)

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
├── public/icons/              ← copied brand assets
├── src/
│   ├── main.tsx               ← entry, mounts <App />
│   ├── App.tsx                ← wraps <AppRoutes /> in <AppShell />
│   ├── routes.tsx             ← React Router routes
│   ├── styles/globals.css     ← Tailwind + brand utility classes
│   ├── lib/
│   │   ├── mockData.ts        ← typed KPIs, products, lab assets
│   │   └── format.ts          ← Intl number / relative date
│   ├── components/
│   │   ├── brand/BrandMark.tsx
│   │   ├── layout/{AppShell,Header,Sidebar}.tsx
│   │   └── ui/{StatCard,SectionTitle,QuickActionTile,PageHeader}.tsx
│   └── pages/                 ← one component per route
└── tailwind.config.ts / vite.config.ts / tsconfig*.json
```

---

## Where the Laravel reference lives

At the repo root: `/`. The current Laravel dashboard's look (commit `4539edf`, Phase 1B) is what this prototype is calibrated to — calmer severity palette, navy hierarchy, section groupings.
