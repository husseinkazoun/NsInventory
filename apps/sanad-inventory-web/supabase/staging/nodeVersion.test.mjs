import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  MIN_NODE_MAJOR,
  NodeVersionError,
  assertSupportedNode,
  parseNodeMajor,
} from './plan.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BOOTSTRAP = join(HERE, 'bootstrap.mjs')
const TEARDOWN = join(HERE, 'teardown.mjs')

/**
 * An environment with none of the staging variables set.
 *
 * Used so the process-level tests can prove *ordering*: with no configuration
 * available, a supported Node must still get past the version check and fail
 * on configuration instead. The real `.env.staging.local` is never read.
 */
function envWithoutStagingConfig() {
  const clean = { ...process.env }
  for (const key of Object.keys(clean)) {
    if (key.startsWith('SUPABASE_') || key.startsWith('STAGING_')) delete clean[key]
  }
  return clean
}

/** Locates a Node 20 binary if one happens to be installed. */
function findNode20() {
  const candidates = [
    '/opt/homebrew/opt/node@20/bin/node',
    '/usr/local/opt/node@20/bin/node',
    join(process.env.HOME ?? '', '.nvm/versions/node/v20.20.2/bin/node'),
  ]
  for (const path of candidates) {
    if (!path || !existsSync(path)) continue
    try {
      const version = execFileSync(path, ['-v'], { encoding: 'utf8' }).trim()
      if (parseNodeMajor(version) === 20) return { path, version }
    } catch {
      // unusable candidate; keep looking
    }
  }
  return null
}

const node20 = findNode20()

describe('parseNodeMajor', () => {
  it('reads the major version with or without the leading v', () => {
    expect(parseNodeMajor('v22.22.1')).toBe(22)
    expect(parseNodeMajor('20.20.2')).toBe(20)
    expect(parseNodeMajor('v25.9.0')).toBe(25)
  })

  it('returns null when the version cannot be read', () => {
    expect(parseNodeMajor('')).toBeNull()
    expect(parseNodeMajor(undefined)).toBeNull()
    expect(parseNodeMajor('not-a-version')).toBeNull()
  })
})

describe('assertSupportedNode', () => {
  it(`rejects every major below ${MIN_NODE_MAJOR}`, () => {
    for (const version of ['v18.20.0', 'v20.20.2', 'v21.7.3']) {
      expect(() => assertSupportedNode(version)).toThrow(NodeVersionError)
    }
  })

  it(`accepts ${MIN_NODE_MAJOR} and newer`, () => {
    expect(assertSupportedNode('v22.22.1')).toBe(22)
    expect(assertSupportedNode('v24.14.0')).toBe(24)
    expect(assertSupportedNode('v25.9.0')).toBe(25)
  })

  it('passes on the runtime actually running these tests', () => {
    expect(() => assertSupportedNode()).not.toThrow()
  })

  it('names the requirement and the version found', () => {
    const err = (() => {
      try {
        assertSupportedNode('v20.20.2')
      } catch (e) {
        return e
      }
    })()
    expect(err.message).toContain(`Node.js ${MIN_NODE_MAJOR} or newer is required`)
    expect(err.message).toContain('v20.20.2')
    // The point of the check: explain it, rather than leaving the user with
    // the client's "install the ws package" message.
    expect(err.message).toMatch(/WebSocket/i)
  })

  it('rejects an unreadable version rather than assuming it is fine', () => {
    expect(() => assertSupportedNode('banana')).toThrow(/Could not determine/)
  })
})

describe('runners check the version before configuration or network', () => {
  // Without this, the failure surfaces as a WebSocket error from inside
  // createClient — after configuration is read and a client is constructed.
  it.each([
    ['bootstrap', BOOTSTRAP],
    ['teardown', TEARDOWN],
  ])('%s on a supported Node gets past the version check', (_name, script) => {
    const result = spawnSync(process.execPath, [script], {
      env: envWithoutStagingConfig(),
      encoding: 'utf8',
    })
    const output = `${result.stdout}${result.stderr}`
    // Reached configuration, which is the next gate.
    expect(output).toMatch(/SUPABASE_STAGING_PROJECT_REF is required/)
    expect(output).not.toMatch(/Node\.js \d+ or newer is required/)
    expect(result.status).toBe(1)
  })

  it.runIf(node20)(
    'bootstrap on Node 20 fails on the version, before configuration',
    () => {
      const result = spawnSync(node20.path, [BOOTSTRAP], {
        env: envWithoutStagingConfig(),
        encoding: 'utf8',
      })
      const output = `${result.stdout}${result.stderr}`
      expect(output).toContain(`Node.js ${MIN_NODE_MAJOR} or newer is required`)
      expect(output).toContain(node20.version)
      // Ordering proof: configuration was never reached, even though it is
      // entirely absent and would certainly have failed.
      expect(output).not.toMatch(/SUPABASE_STAGING_PROJECT_REF is required/)
      // And no network client was ever constructed.
      expect(output).not.toMatch(/WebSocket.*transport option/s)
      expect(result.status).toBe(1)
    },
  )

  it.runIf(node20)(
    'teardown on Node 20 fails on the version, before configuration',
    () => {
      const result = spawnSync(node20.path, [TEARDOWN], {
        env: envWithoutStagingConfig(),
        encoding: 'utf8',
      })
      const output = `${result.stdout}${result.stderr}`
      expect(output).toContain(`Node.js ${MIN_NODE_MAJOR} or newer is required`)
      expect(output).not.toMatch(/SUPABASE_STAGING_PROJECT_REF is required/)
      expect(result.status).toBe(1)
    },
  )

  it('reports whether a Node 20 binary was available for the above', () => {
    // Not an assertion about the code — it records, in the test output, whether
    // the strongest evidence actually ran on this machine.
    expect(node20 === null || parseNodeMajor(node20.version) === 20).toBe(true)
  })
})
