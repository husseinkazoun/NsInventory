# Architecture & Product Direction

> Working document. Captures *intent* for where this codebase is going, not a commitment.
> The current Laravel 10 app (with the lab-asset / photo-scanning module) remains the source of truth for what exists today.

---

## 1. Product vision

This codebase is being grown from an internal inventory tool into a **standalone smart inventory, asset management, and AI visual inspection platform** that many organisations can deploy.

### Early use cases (drivers, not boundaries)

- **Nation Station — AI lab inventory & asset tracking.** First real customer. Drives the lab-asset / photo-scanning feature set: computers, peripherals, missing-component detection, condition assessment, assignment to users.
- **Warshe / Jetson visual QC (future).** Second envisioned use case. A workshop / production QC station running a Jetson Orin Nano (or similar) for local capture + inference, sending photos and findings up to this platform for review, audit, and reporting.

### Target market beyond the early users

- NGO field teams managing donations + lab/IT equipment.
- Small/medium workshops doing incoming-goods inspection or repair intake.
- Maker spaces and university labs tracking tools, kits, components.
- Light-manufacturing QC where someone needs an audit trail of *what was checked, by whom, against which checklist, and what the AI and human said*.

The product target is **many organisations**, not a hardwired single-tenant Nation Station deployment.

---

## 2. Current Laravel app foundation

### Stack

- **Laravel 10**, **PHP 8.1+** (8.2 on the dev Mac mini M4).
- **MySQL 8** in dev; MySQL or MariaDB in production.
- Blade + Tabler UI + Livewire 3 + PowerGrid + shoppingcart helpers.
- Native (non-Docker) dev environment. Docker assets remain in the repo only as historical / optional deployment reference.

### Normal inventory features (existing)

- Products with categories, units, stock, buying/selling price, tax, barcodes.
- Orders (POS) — create / pending / complete / due.
- Purchases with approval workflow + daily reports.
- Quotations.
- Customers, suppliers, users with roles.
- Dashboards and Excel import/export.

### Lab asset management (existing)

- `products.product_type` column (`regular` | `lab_asset`) — single table, two product flavours.
- Additional lab-asset fields on `products`: `serial_number`, `model`, `manufacturer`, `part_number`, `asset_tag`, `location`, `room`, `department`, `assigned_to`, `assignment_date`, `condition_status`, `asset_status`, maintenance dates, warranty, `scan_data`, `scan_confidence`, `last_scanned`.
- `LabAssetController` provides dashboard, list, create, edit, show, delete.
- Lab-asset listings use `Product::scopeLabAssets()`; regular product listings use `Product::scopeRegularProducts()` — applied across `ProductController`, the Livewire/PowerGrid product tables, order/purchase/quotation pickers, search, export, import, and the dashboard count, so the two flavours don't leak into each other.

### Scanning sessions, photo scans, missing components (existing)

- **`scanning_sessions`** — one row per "I'm scanning this device now" event. Tracks user, location, device info, photo counts, processing time, average confidence, status (`in_progress` | `completed` | `failed` | `cancelled`).
- **`photo_scans`** — per-photo records with `photo_type` enum (`overview` | `serial_label` | `components` | `condition`), AI results (OCR text, object detection, classification), extracted serial / model / manufacturer, detected condition, missing-component list, processing status, error message.
- **`missing_components`** — generic "what's missing from this device" records. `detected_by` (`scan` | `manual` | `audit`), confidence, `status` (`missing` | `ordered` | `received` | `installed`), resolution metadata.

### OpenAI Vision service (existing)

- `App\Services\OpenAIVisionService` — sends one base64-encoded image per call to the OpenAI chat-completions endpoint with a prompt selected by `photo_type` × `session_type`.
- Config-driven via `config/services.php` + env: `OPENAI_API_KEY`, `OPENAI_API_BASE`, `OPENAI_MODEL` (default `gpt-4o`).
- `response_format: json_object` forces structured output; the service parses the JSON and maps fields onto `PhotoScan` columns.
- Async-ready: `ProcessPhotoScan` is a queueable job. Dev default is `QUEUE_CONNECTION=sync` so it runs inline; production can switch to `database` + a `queue:work` worker.

### Human review / save flow (existing)

- User completes Step 1–3 photo capture in the scan UI (overview, serial/labels, components).
- Step 4 is a review page: AI-extracted name / manufacturer / model / serial / condition / location are pre-filled but editable.
- User picks **Category + Unit** (required) and confirms.
- `ScanningController::completeSession` groups scans by extracted identity, creates one `Product` per group as `product_type = lab_asset`, links photo scans to the product, and writes `MissingComponent` rows for components detected in ≥ 2 photos across the session.

---

## 3. Architecture principle

> **Keep the core generic. Push customer-specific logic to configuration, templates, modules, or seed data.**

Concretely:

- Nation-Station-specific things — branding, default categories, example users, the "AI lab" naming — live as **seed data, labels, and deployment configuration**, never in core tables or model code.
- Warshe-specific wood-QC workflows arrive later as an **inspection template / module**, not as bespoke tables hardwired into the foundation.
- Code refers to generic concepts: *asset*, *scan*, *finding*, *decision*, *source device*, *AI provider*, *review status*. Industry-specific vocabulary (e.g. "wood grade", "knot count", "cable kit") goes into templates and config, not into the database column list.
- Anything that says "Nation Station" or "Warshe" in a class name, table name, route, or migration is a smell. Acceptable in seeds, fixtures, organisation records, demo data.

---

## 4. Future generic inspection model (direction only — do not implement yet)

Today's `scanning_sessions` + `photo_scans` + `missing_components` are good enough for the lab-asset use case but are tied to "scan a device" semantics. The natural generalisation is an **inspection model** that covers lab scans, incoming-goods QC, repair intake, warehouse checks, and Jetson-driven production QC under one shape.

Sketch (names are illustrative, not committed):

| Concept | Purpose | Roughly maps from today's |
|---|---|---|
| **`InspectionSession`** | One end-to-end "this inspection happened" event with type, user, source device, target (product / asset / lot / work-order). | `scanning_sessions` |
| **`InspectionPhoto`** | One captured image, with role (`overview`, `label`, `defect`, `serial`, …) and storage path. | the file / metadata half of `photo_scans` |
| **`AIAnalysisResult`** | One AI provider's analysis of one photo or session: provider, model, prompt version, raw response, parsed fields, confidence. | the AI-result half of `photo_scans` |
| **`InspectionFinding`** | A single thing found: a missing component, a defect, an extracted field, a checklist item answered. Polymorphic across kinds. | `missing_components` + ad-hoc fields on `photo_scans` |
| **`InspectionDecision`** | Reviewer's verdict on the session or a finding: approve / reject / repair / rescan / escalate, with reason and reviewer. | implicit in today's "save asset" step |
| **`InspectionTemplate`** | Reusable definition of an inspection type: which photos are expected, which checks run, which prompts to send. | hard-coded prompts in `OpenAIVisionService` |
| **`InspectionChecklist`** | A template instance attached to a session: per-item state, owner, due-by. | doesn't exist yet |
| **`SourceDevice`** | Where a session/photo came from: browser, phone, kiosk, Jetson Orin Nano #3, etc. Useful for filtering, debugging, and edge-device fleet ops. | doesn't exist yet |

The point of writing this down is to make sure **today's code doesn't accidentally make this generalisation harder**. The current names (`PhotoScan`, `MissingComponent`, `ScanningSession`) are specific to scanning, but the table shapes are general enough that they can be renamed / split later without data loss.

---

## 5. Edge device direction

A Jetson Orin Nano (or any other edge device) should act as a **capture / inference client**, not a parallel app.

Expected shape:

- The edge device runs local capture (camera or barcode reader) and, optionally, local inference (TensorRT / a small VLM / a defect detector trained for the customer).
- The device authenticates to this Laravel app via a token (Sanctum personal access token or an API key bound to a `SourceDevice` record).
- The device POSTs one of:
  - **Just raw photos** → Laravel runs the AI pipeline (current model: OpenAI Vision).
  - **Photos + local inference results** → Laravel stores both, marks the AI result as coming from the edge model, and optionally re-checks with the cloud model.
- Laravel remains the **single source of truth**: which sessions exist, who reviewed them, what decisions were made, what gets reported.
- Reviewers use the Laravel UI on a phone, tablet, or workstation; the edge device is not the review surface.

No code is required for this yet. The constraint on today's work is just: **don't bake assumptions that the photo always came from `navigator.mediaDevices` in a browser**.

---

## 6. What should stay generic now

Today's code should treat these as cross-cutting concepts, not Nation-Station-flavoured ones:

- **Scans / photos / sessions.** Schema is already polymorphic-friendly via `session_type`. Keep prompts and field names generic.
- **Assets and products.** The `product_type` enum lets one table cover both flavours; that's correct. Adding new types later (`raw_material`, `tool`, `consumable`) should be additive.
- **Missing components and defects as findings.** `missing_components` is a special case of "finding". When the next finding type lands (a defect, a damage note, a non-conformance), prefer extending this shape rather than creating a parallel `defects` table.
- **AI provider configuration.** `config/services.php` already keys off `OPENAI_API_KEY` / `OPENAI_API_BASE` / `OPENAI_MODEL`. Future providers (a local Jetson model, Anthropic, an in-house ONNX server) should land as additional `config('services.<provider>')` blocks and a small `VisionProvider` interface — not as a fork of `OpenAIVisionService`.
- **Review status / decisions.** Even though we don't have a generic `decisions` table yet, treat the "save asset" step as a decision event; don't burn customer-specific verdict names into the UI.

---

## 7. What should be deferred

Explicitly out of scope right now:

- **Laravel upgrade (10 → 11 / 12).** Tempting but not load-bearing. Defer until after the native-boot verification and at least one real-data scan flow has been run end-to-end.
- **Multi-tenancy.** No `organizations` / `tenants` table yet. Designing it before we know whether tenants share AI quotas, storage buckets, or RLS rules is premature.
- **Warshe-specific wood-QC tables.** Will arrive as a template + module on the generic inspection model, not as a parallel schema.
- **Jetson API implementation.** Section 5 is direction only.
- **Major model renames.** `PhotoScan` → `InspectionPhoto`, `ScanningSession` → `InspectionSession`, `MissingComponent` → `InspectionFinding` are all on the table — but only after the inspection-model shape is committed and code paths / tests exist to migrate cleanly.
- **Big rewrites before boot verification.** Until the native app runs locally and the existing lab-asset flow is verified end-to-end, all of the above is theoretical.

---

## 8. Immediate next step (after this document)

Boot the platform natively on the Mac mini M4 and verify the existing workflow before adding anything new.

Checklist:

1. Install PHP 8.2, Composer, Node 20, MySQL 8 per the native-setup plan written earlier in this work stream.
2. `composer install && npm install && npm run dev` (one terminal) and `php artisan serve` (another terminal).
3. `php artisan migrate:fresh --seed` and `php artisan storage:link`.
4. Log in at `http://127.0.0.1:8000/login` as `admin@admin.com / password`.
5. Verify **normal inventory** screens still work: products list, order create, purchase create, customer/supplier CRUD.
6. Verify **lab asset** screens render: `/lab-assets`, `/lab-assets/dashboard`, `/lab-assets/create`, `/lab-assets/{slug}`, `/lab-assets/{slug}/edit`.
7. Verify the **scan workflow** end-to-end: open `/lab-assets/scan/interface`, complete the four photo steps with any device (camera or file upload), and reach the Step-4 review. With a valid `OPENAI_API_KEY`, the AI should populate fields; without one, the page should still load and the AI fields should be empty / show an error.
8. Save one scanned asset and confirm:
   - It appears under `/lab-assets` (lab-asset list).
   - It does **not** appear under `/products` (regular product list).
   - It does **not** show up in order / purchase / quotation product pickers.
   - The dashboard product count excludes it.
9. Only after this passes do we start on step #5 (factories + feature tests) or revisit the inspection-model generalisation.
