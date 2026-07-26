import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { installWebStorage } from './webStorage'

// Must run before any test module touches storage. Node >= 22 ships Web
// Storage globals that shadow jsdom's, and without a `--localstorage-file`
// they are hollow (`localStorage.clear` is undefined), which fails every test
// that clears storage. See ./webStorage.ts for the full explanation.
installWebStorage()

// Testing Library only auto-registers cleanup when Vitest runs with
// `globals: true`. This project keeps globals off so `tsc --noEmit` typechecks
// the test files without ambient config, so cleanup is registered by hand.
// Without it, renders accumulate across tests and queries match duplicates.
afterEach(() => {
  cleanup()
})
