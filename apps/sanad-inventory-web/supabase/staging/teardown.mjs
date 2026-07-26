#!/usr/bin/env node
/**
 * Staging teardown — removes everything `bootstrap.mjs` created, and nothing
 * else.
 *
 *   node supabase/staging/teardown.mjs            # dry run, deletes nothing
 *   node supabase/staging/teardown.mjs --apply    # actually deletes
 *
 * Scope is deliberately narrow and never pattern-matched loosely:
 *   * rows are deleted only where organization_id = the staging organization id
 *   * Auth users are deleted only when the address ends in the staging domain
 *     (a reserved .invalid TLD, so it cannot be a real person)
 *   * Storage objects are deleted only under the staging organization prefix
 *
 * It never issues an unqualified DELETE, and it will not run against a project
 * listed in SUPABASE_PRODUCTION_PROJECT_REFS.
 */
import { createClient } from '@supabase/supabase-js'
import {
  STAGING_IDS,
  STORAGE_BUCKET,
  TEARDOWN_TABLE_ORDER,
  assertSupportedNode,
  buildStagingAccounts,
  isStagingEmail,
  readConfig,
} from './plan.mjs'

const APPLY = process.argv.includes('--apply')

function log(...args) {
  console.log(...args)
}

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

async function listAllUsers(admin) {
  const users = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < 200) break
  }
  return users
}

async function main() {
  // Runtime check first: before configuration is read and before any
  // network call, so an unsupported Node fails with a version message
  // rather than a confusing WebSocket error from deep inside the client.
  try {
    assertSupportedNode()
  } catch (err) {
    fail(err.message)
  }

  let config
  try {
    config = readConfig(process.env)
  } catch (err) {
    fail(`${err.message}\n\n  See supabase/staging/.env.example for the full list.`)
  }

  const accounts = buildStagingAccounts(config.emailDomain)

  log('Sanad Inventory — staging teardown')
  log('──────────────────────────────────')
  log(`  target project ref : ${config.projectRef}`)
  log(`  organization id    : ${STAGING_IDS.organization}`)
  log(`  account domain     : @${config.emailDomain}`)
  log(`  mode               : ${APPLY ? 'APPLY (deletes)' : 'DRY RUN (no deletes)'}`)
  log('')

  if (!APPLY) {
    log('Dry run only. Nothing was deleted.')
    log('Re-run with --apply once the target above is correct.')
    return
  }

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 1. storage objects under the staging org prefix ─────────────────
  log('1/4  storage objects')
  const prefix = STAGING_IDS.organization
  const { data: sessions, error: listError } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(prefix, { limit: 1000 })
  if (listError && !/not found/i.test(listError.message)) throw listError

  const toRemove = []
  for (const entry of sessions ?? []) {
    const { data: files } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(`${prefix}/${entry.name}`, { limit: 1000 })
    for (const file of files ?? []) {
      toRemove.push(`${prefix}/${entry.name}/${file.name}`)
    }
  }
  if (toRemove.length) {
    const { error } = await admin.storage.from(STORAGE_BUCKET).remove(toRemove)
    if (error) throw error
  }
  log(`     ✓ removed ${toRemove.length} object(s)`)

  // ── 2. org-scoped rows, FK-safe order ───────────────────────────────
  log('2/4  organization-scoped rows')
  for (const table of TEARDOWN_TABLE_ORDER) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq('organization_id', STAGING_IDS.organization)
    if (error) throw error
    log(`     ✓ ${table}`)
  }

  // ── 3. the organization itself ──────────────────────────────────────
  log('3/4  organization')
  const { error: orgError } = await admin
    .from('organizations')
    .delete()
    .eq('id', STAGING_IDS.organization)
  if (orgError) throw orgError
  log('     ✓ removed')

  // ── 4. Auth users (cascades profiles) ───────────────────────────────
  // profiles.id references auth.users ON DELETE CASCADE, so removing the Auth
  // user removes its profile. Org rows had to go first because
  // lab_assets.created_by references profiles with no ON DELETE action.
  log('4/4  Auth users')
  const expected = new Set(accounts.map((a) => a.email.toLowerCase()))
  const all = await listAllUsers(admin)
  let removed = 0
  for (const user of all) {
    const email = user.email?.toLowerCase()
    // Two independent conditions must both hold before a delete.
    if (!email || !isStagingEmail(email, config.emailDomain)) continue
    if (!expected.has(email)) {
      log(`     ! skipping ${email} — staging domain but not a known account`)
      continue
    }
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
    removed += 1
    log(`     - ${email}`)
  }
  log(`     ✓ removed ${removed} account(s)`)

  log('')
  log('Staging data removed. The project, its Auth settings and the bucket remain.')
}

main().catch((err) => {
  fail(err?.message ?? String(err))
})
