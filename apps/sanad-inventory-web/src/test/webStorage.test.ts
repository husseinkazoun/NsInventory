import { beforeEach, describe, expect, it } from 'vitest'
import { createStorage } from './webStorage'

/**
 * Conformance tests for the test-environment Storage.
 *
 * The suite's real assertions (saved organization selections, one-shot expiry
 * notices) are only meaningful if storage behaves like the browser's. A
 * polyfill that silently dropped writes, or returned `undefined` instead of
 * `null`, would make those tests pass for the wrong reason.
 */
describe('Storage conformance', () => {
  let storage: Storage

  beforeEach(() => {
    storage = createStorage()
  })

  it('round-trips a value', () => {
    storage.setItem('a', '1')
    expect(storage.getItem('a')).toBe('1')
  })

  it('returns null — not undefined — for a missing key', () => {
    // authNotice/org.ts compare against null; undefined would change branches.
    expect(storage.getItem('nope')).toBeNull()
    expect(storage.getItem('nope')).not.toBeUndefined()
  })

  it('stringifies keys and values', () => {
    storage.setItem(1 as unknown as string, null as unknown as string)
    expect(storage.getItem('1')).toBe('null')
    storage.setItem('u', undefined as unknown as string)
    expect(storage.getItem('u')).toBe('undefined')
  })

  it('tracks length as entries are added and removed', () => {
    expect(storage.length).toBe(0)
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    expect(storage.length).toBe(2)
    storage.removeItem('a')
    expect(storage.length).toBe(1)
  })

  it('overwrites without growing, keeping insertion order', () => {
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.setItem('a', '3')
    expect(storage.length).toBe(2)
    expect(storage.getItem('a')).toBe('3')
    // Per spec, re-setting an existing key keeps its original position.
    expect(storage.key(0)).toBe('a')
    expect(storage.key(1)).toBe('b')
  })

  it('returns null from key() when the index is out of range', () => {
    storage.setItem('a', '1')
    expect(storage.key(0)).toBe('a')
    expect(storage.key(1)).toBeNull()
    expect(storage.key(-1)).toBeNull()
    expect(storage.key(NaN)).toBeNull()
  })

  it('ignores removal of a key that is not present', () => {
    expect(() => storage.removeItem('ghost')).not.toThrow()
    expect(storage.length).toBe(0)
  })

  it('empties completely on clear()', () => {
    storage.setItem('a', '1')
    storage.setItem('b', '2')
    storage.clear()
    expect(storage.length).toBe(0)
    expect(storage.getItem('a')).toBeNull()
  })
})

describe('installed globals', () => {
  it('exposes working storage on window and globalThis', () => {
    // The concrete failure this whole module exists to fix.
    expect(typeof window.localStorage.clear).toBe('function')
    expect(typeof window.sessionStorage.clear).toBe('function')

    window.localStorage.setItem('probe', 'v')
    expect(window.localStorage.getItem('probe')).toBe('v')
    window.localStorage.clear()
    expect(window.localStorage.getItem('probe')).toBeNull()
  })

  it('keeps localStorage and sessionStorage independent', () => {
    window.localStorage.setItem('shared', 'local')
    window.sessionStorage.setItem('shared', 'session')
    expect(window.localStorage.getItem('shared')).toBe('local')
    expect(window.sessionStorage.getItem('shared')).toBe('session')
    window.localStorage.clear()
    // Clearing one must not clear the other.
    expect(window.sessionStorage.getItem('shared')).toBe('session')
    window.sessionStorage.clear()
  })
})
