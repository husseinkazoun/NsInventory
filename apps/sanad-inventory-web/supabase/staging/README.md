# Staging setup guide

How to stand up a **separate** Supabase staging project, apply the migrations,
seed four role accounts, and verify the role matrix end to end.

> **Production is never a valid target.** These scripts refuse to run unless
> you name the staging project explicitly *and* confirm intent. Put your
> production project reference in `SUPABASE_PRODUCTION_PROJECT_REFS` locally
> and they will refuse it outright. No production reference is committed to
> this repository.

---

## 1. Create or select a staging project

Dashboard → **New project**.

| Setting | Value |
|---|---|
| Name | `sanad-inventory-staging` |
| Organization | the same org as the inventory project |
| Region | match production, so latency and Postgres version behave alike |
| Plan | Free is sufficient |
| DB password | generate a strong one, store it in a password manager |

Wait for the project to reach **ACTIVE_HEALTHY**, then note its **project
reference** (20 lowercase letters, visible in the URL and under Project
Settings → General). That reference is the only thing you need to share.

Do **not** reuse an existing project belonging to another product.

## 2. Auth settings

Project Settings → **Authentication**.

| Setting | Value | Why |
|---|---|---|
| Site URL | `http://127.0.0.1:5174` for local, or your staging Pages URL | Where auth redirects land |
| Redirect URLs | add both of the above | Deep links after sign-in |
| **Allow new users to sign up** | **Disabled** | Matches the Laravel decision to disable self-registration (commit `a4605a5`). Supabase enables sign-up by default, so leaving it on silently reverses that choice. The bootstrap script creates users through the Admin API, which is unaffected. |
| Confirm email | may stay enabled | The script sets `email_confirm: true`, so its accounts are usable immediately |
| Leaked password protection | **Enable** | Staging is the right place to test it before production |

## 3. Storage

`0002_scans.sql` creates the private `lab-asset-scans` bucket idempotently, and
the bootstrap script creates it too if it is missing. After applying
migrations, confirm under **Storage** that the bucket exists and is **private**
(not public). If your environment forbids writes to `storage.buckets`, create
it in the dashboard with that exact name and visibility, then re-run the
migration so the policies install.

## 4. Environment variables

```bash
cp supabase/staging/.env.example supabase/staging/.env.staging.local
# fill in the real values, then:
set -a && . supabase/staging/.env.staging.local && set +a
```

`.env.staging.local` is gitignored. **Never** commit it, paste the service-role
key into chat or a ticket, or put it anywhere a browser can read it.

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_STAGING_PROJECT_REF` | yes | The staging project reference. Naming it is what makes the guard meaningful — the URL must contain this exact value. |
| `SUPABASE_STAGING_URL` | yes | `https://<ref>.supabase.co` |
| `SUPABASE_STAGING_SERVICE_ROLE_KEY` | yes | Staging service-role key. Bypasses RLS; server-side only. |
| `STAGING_USER_PASSWORD` | yes | Shared password for the four fake accounts, minimum 12 characters. |
| `STAGING_BOOTSTRAP_CONFIRM` | yes | Must be `yes`. Acknowledges that `--apply` writes to a hosted project. |
| `SUPABASE_PRODUCTION_PROJECT_REFS` | recommended | Comma-separated refs the scripts must never touch. Put production here. |
| `STAGING_EMAIL_DOMAIN` | no | Defaults to `sanad-staging.invalid`. |
| `STAGING_ORG_SLUG` | no | Defaults to `sanad-staging`. |

## 5. Apply migrations, in order

```bash
supabase link --project-ref "$SUPABASE_STAGING_PROJECT_REF"
supabase db push
```

`db push` applies `supabase/migrations/*.sql` in filename order:

1. `0001_initial.sql` — organizations, profiles, memberships, lab assets, activity log
2. `0002_scans.sql` — scan sessions, photo scans, missing components, Storage bucket + policies
3. `20260725161641_role_based_rls.sql` — the role matrix, `private` helpers, explicit grants

Confirm with `supabase migration list`.

## 6. Run the bootstrap

```bash
npm run staging:bootstrap             # dry run — prints the plan, writes nothing
npm run staging:bootstrap -- --apply  # actually writes
```

It creates, in this order (forced by the foreign keys):

1. **Auth users** via the Admin API — never by inserting into `auth.users`
2. **`profiles`** — must exist before memberships, because
   `organization_members.user_id` references `profiles.id`
3. **`organizations`** — one row, `Sanad Inventory (STAGING)`
4. **`organization_members`** — the four roles
5. **Fixtures** — 2 categories, 2 units, 3 lab assets, 1 scan session, 1 photo
   scan, 1 missing component, 1 activity row
6. **Storage** — private bucket plus one 1×1 PNG at
   `{org_id}/{scan_session_id}/staging-sample.png`, so the org-prefix rule in
   `scan_object_org()` has something to match

### Accounts

| Role | Email |
|---|---|
| owner | `owner@sanad-staging.invalid` |
| admin | `admin@sanad-staging.invalid` |
| member | `member@sanad-staging.invalid` |
| viewer | `viewer@sanad-staging.invalid` |

`.invalid` is reserved by RFC 2606, so these addresses can never reach a real
person. The password is whatever you set in `STAGING_USER_PASSWORD`; the script
never prints it.

### Re-running

Safe and idempotent. A second run:

- **Auth users** — matches on email. Existing accounts are *updated* (password
  reset to `STAGING_USER_PASSWORD`, metadata refreshed), not duplicated. User
  ids are preserved, so memberships and `created_by` references stay valid.
- **profiles / organization / memberships / fixtures** — upserted on their
  primary key. All ids are hardcoded and deterministic (the `5ada` prefix), so
  rows are overwritten in place. Row counts do not grow.
- **Storage** — uploaded with `upsert: true`, replacing the object.
- **Anything you changed by hand** inside those rows is reset to the seed
  values. Anything you *added* — a new asset created through the UI while
  testing — is left alone, because the script only touches its own ids.

So: re-run freely to reset to a known state. It will not accumulate duplicates
and will not delete your ad-hoc test rows.

## 7. Point the frontend at staging

```bash
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` to the staging URL and `VITE_SUPABASE_ANON_KEY` to the
staging **anon/publishable** key (not the service-role key — the anon key is
meant to be public and ships in the client bundle). Then:

```bash
npm run dev   # http://127.0.0.1:5174
```

`.env.local` is gitignored.

## 8. Verify each role

Sign in as each account in turn. Expected behaviour, all enforced by RLS:

| Role | Sees inventory | Add / edit | Delete | UI |
|---|---|---|---|---|
| `owner` | yes | yes | yes | all actions visible |
| `admin` | yes | yes | yes | all actions visible |
| `member` | yes | yes | **no** | no delete actions |
| `viewer` | yes | **no** | **no** | read-only; "Add Lab Asset" and "Start Photo Scan" hidden; `/lab-assets/new` and `/scan/start` show the read-only notice |

Checks worth doing by hand:

- **Anonymous** — sign out and open `/lab-assets`. You should be redirected to
  `/login` and see no data. Hitting the REST endpoint directly with only the
  anon key must return `[]`, never rows.
- **viewer bypass** — as `viewer`, navigate straight to `/lab-assets/new`. The
  UI explains it is read-only; even if you bypassed the UI, the insert is
  refused by RLS. Frontend gating is UX only.
- **member delete** — as `member`, attempt a delete through the API. It should
  affect 0 rows rather than error, because RLS filters rather than raising on
  DELETE.
- **Storage** — as `viewer`, a signed URL for the seeded object should work;
  uploading should not.
- **Revocation** — remove a membership row via the SQL editor and confirm that
  user immediately loses access.

Cross-organization isolation is covered by the local database suite
(`npm run test:db`), which seeds two organizations. This package deliberately
creates only one.

## 9. Re-run the advisors

After the migration is applied to staging:

```bash
supabase db advisors --linked                    # security
supabase db advisors --linked --type performance
```

Or via a project-scoped MCP connection pointed at **staging**.

Expect these to have cleared, compared with the pre-migration baseline:

- `function_search_path_mutable` on `set_updated_at` and `scan_object_org`
- `anon_security_definer_function_executable` / `authenticated_…` for
  `public.is_org_member` (the function is dropped)
- all four `auth_rls_initplan` warnings

Expect these to **remain**, and they are not defects:

- `anon_security_definer_function_executable` for `public.rls_auto_enable` —
  Supabase's own `ensure_rls` event-trigger function. It returns
  `event_trigger`, so it cannot actually be invoked over RPC.
- `unindexed_foreign_keys` and `unused_index` (INFO) — out of scope here.
- `auth_leaked_password_protection`, unless you enabled it in step 2.

## 10. Tear down

```bash
npm run staging:teardown             # dry run
npm run staging:teardown -- --apply  # actually deletes
```

Scope is narrow by construction: rows only where
`organization_id = 5ada0000-0000-4000-8000-000000000001`, Auth users only where
the address ends in the staging domain *and* matches a known account name, and
Storage objects only under the staging organization prefix. There is no
unqualified `DELETE` anywhere in it. The project, its Auth settings and the
bucket survive — only the seeded data goes.
