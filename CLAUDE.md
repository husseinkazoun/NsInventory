# Sanad Smart Inventory — Project Memory

## 1. Active Repository

- **Active path**: `/Volumes/Kingston-XS2000/Projects/NsInventory`
- **GitHub**: `git@github.com:husseinkazoun/NsInventory.git`

> ⚠️ **Stale copy warning**: `/Volumes/T4-SanDisk/Websites:Apps/NsInventory/enhanced-inventory-system`
> is an older T4-SanDisk copy. **Do not use or edit it.** All work happens in the
> Kingston repo above.

## 2. Branch & Latest Pushed Commit

- **Current branch**: `main` (tracks `origin/main`)
- **Latest branding commit (pushed)**:

  ```
  93801f8 feat(brand): add Sanad inventory branding and app icons
  ```

## 3. Application Stack

- **Laravel**: 10.48.22
- **Vite**: 6.4.2
- **laravel-vite-plugin**: 1.3.0
- **PHP**: required by `composer.json`
- **CSS framework**: Tailwind 3.4 + Tabler Core 1.0-beta24
- **Database**: MySQL (`inventory_management_system`)

Dev runbook:

```bash
php artisan serve --host=127.0.0.1 --port=8000   # Laravel
npm run dev                                       # Vite (5173)
```

## 4. Branding Decision

- **Final logo**: Variant B — rising 3-node Sanad Inventory mark.
- **Location**: `public/icons/` (PNG/SVG/ICO frames).
- **Archived history (do not revive as live brand)**:
  `public/static/sanad-inventory-logo.v1-sanad-derived.svg`
  (the old parent-Sanad S-swoosh derivative — kept only for traceability).

Rule: **Do not re-introduce the S-swoosh logo into live views.** If a brand
question arises, prefer assets under `public/icons/`.

## 5. Icon & `<head>` Wiring

- `public/favicon.ico` and `public/icons/favicon.ico` are multi-frame ICOs
  containing **16, 24, 32, 48, 64** sizes.
- Web manifest: `public/icons/site.webmanifest`.
- Layouts that contain the **favicon / apple-touch / manifest / theme-color**
  head block:
  - `resources/views/layouts/tabler.blade.php`
  - `resources/views/layouts/auth.blade.php`

If you add a new top-level layout, mirror the same head block.

## 6. Brand CSS

- `public/static/brand.css` — Phase 2 brand polish (colors, header/footer/login
  surfaces).
- References `/icons/sanad-inventory-tile.svg` for branded tile/background
  usage.
- Reproducible icon generation: `scripts/build-icons.py`.

## 7. Test Status (as of latest branding commit)

```
php artisan test
→ 69 tests, 209 assertions, all passing.
```

Re-run before commits when feasible (see working rules below).

## 8. Working Rules for Claude

- **Always confirm** `pwd` is `/Volumes/Kingston-XS2000/Projects/NsInventory`
  before any edits.
- **Never edit** the T4-SanDisk copy (`/Volumes/T4-SanDisk/Websites:Apps/...`).
- **Never push directly to `main`** unless the user explicitly asks.
- **Before committing**, run `php artisan test` when feasible, and run
  `node --check` / `npx tsc --noEmit` style checks for any JS/TS touched.
- **Preserve** routes, auth logic, and dashboard logic unless specifically
  asked to change them.
- **Prefer surgical edits** over wholesale rewrites.
- **Branding**: stick to Variant B assets in `public/icons/`; do not revive the
  S-swoosh logo.

## 9. Immediate Product Direction

Evolve this from a generic inventory dashboard into **Sanad Smart Inventory**
for humanitarian / NGO operations. Target domains:

- Procurement workflows
- Asset management (general + lab assets)
- Orders, purchases, quotations
- Future **AI inspection workflows** (image-based condition checks,
  damage/quality scoring, intake automation)

Decisions and feature work should be framed against this NGO/humanitarian
context, not generic SMB inventory needs.
