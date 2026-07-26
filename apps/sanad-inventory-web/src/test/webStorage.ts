/**
 * Standards-compatible `localStorage` / `sessionStorage` for the test
 * environment.
 *
 * Why this exists
 * ---------------
 * Node 22 introduced built-in Web Storage globals; from Node 25 they are
 * present by default. Node backs `localStorage` with a file supplied via
 * `--localstorage-file`, and when no valid path is given it still exposes a
 * global — but a hollow one:
 *
 *     $ node -e "console.log(typeof localStorage, typeof localStorage.clear)"
 *     object undefined
 *     Warning: `--localstorage-file` was provided without a valid path
 *
 * Vitest's jsdom environment makes `window` and `globalThis` the same object,
 * and Node's global getter wins over jsdom's own (spec-compliant) Storage. So
 * `window.localStorage` resolves to Node's hollow object and every call fails
 * with `window.localStorage.clear is not a function`.
 *
 * The symptom is Node-version dependent: on Node 20 there are no built-in
 * storage globals, jsdom's implementation is used, and the suite passes. That
 * is why this only appears on newer runtimes.
 *
 * The fix replaces the broken global with a real implementation of the WHATWG
 * Storage interface. Both globals are `configurable: true`, so redefining them
 * is legitimate rather than a hack. An existing *working* implementation
 * (jsdom's, on older Node) is left untouched.
 *
 * This affects the test environment only — no production code imports it.
 */

/**
 * In-memory Storage per the WHATWG spec:
 * https://html.spec.whatwg.org/multipage/webstorage.html#the-storage-interface
 *
 * A `Map` gives insertion-ordered keys, which `key(index)` requires, and
 * re-setting an existing key keeps its original position — also per spec.
 */
export function createStorage(): Storage {
  const entries = new Map<string, string>()

  const storage = {
    get length(): number {
      return entries.size
    },

    key(index: number): string | null {
      // Spec: the argument is an unsigned long; out-of-range returns null.
      const n = Math.trunc(Number(index))
      if (!Number.isFinite(n) || n < 0 || n >= entries.size) return null
      return [...entries.keys()][n] ?? null
    },

    getItem(key: string): string | null {
      // Spec: missing keys yield null, never undefined.
      const value = entries.get(String(key))
      return value === undefined ? null : value
    },

    setItem(key: string, value: string): void {
      // Spec: both key and value are stringified (setItem(1, null) stores
      // "1" -> "null").
      entries.set(String(key), String(value))
    },

    removeItem(key: string): void {
      entries.delete(String(key))
    },

    clear(): void {
      entries.clear()
    },
  }

  return storage as Storage
}

/** True only if `candidate` is a Storage that actually round-trips a value. */
function isWorkingStorage(candidate: unknown): boolean {
  if (!candidate || typeof candidate !== 'object') return false
  const s = candidate as Partial<Storage>
  if (
    typeof s.getItem !== 'function' ||
    typeof s.setItem !== 'function' ||
    typeof s.removeItem !== 'function' ||
    typeof s.clear !== 'function'
  ) {
    return false
  }
  // Presence of the methods isn't proof they work — Node's file-backed
  // implementation can throw on access. Prove it with a round trip.
  try {
    const probe = '__sanad_storage_probe__'
    s.setItem!(probe, '1')
    const ok = s.getItem!(probe) === '1'
    s.removeItem!(probe)
    return ok
  } catch {
    return false
  }
}

function install(target: object, name: 'localStorage' | 'sessionStorage'): void {
  let existing: unknown
  try {
    existing = (target as Record<string, unknown>)[name]
  } catch {
    // A throwing getter counts as broken.
    existing = undefined
  }

  if (isWorkingStorage(existing)) return

  Object.defineProperty(target, name, {
    value: createStorage(),
    configurable: true,
    enumerable: true,
    writable: false,
  })
}

/**
 * Installs working Web Storage on `globalThis` (and on `window` when it is a
 * distinct object) unless a functioning implementation is already present.
 * Safe to call more than once.
 */
export function installWebStorage(): void {
  install(globalThis, 'localStorage')
  install(globalThis, 'sessionStorage')

  // Under Vitest's jsdom environment `window === globalThis`, so the calls
  // above already cover `window.*`. Guard anyway: if a future Vitest or
  // environment keeps them separate, the tests reference `window.*` and must
  // still see a working Storage.
  const win = (globalThis as { window?: object }).window
  if (win && win !== globalThis) {
    install(win, 'localStorage')
    install(win, 'sessionStorage')
  }
}
