import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Testing Library only auto-registers cleanup when Vitest runs with
// `globals: true`. This project keeps globals off so `tsc --noEmit` typechecks
// the test files without ambient config, so cleanup is registered by hand.
// Without it, renders accumulate across tests and queries match duplicates.
afterEach(() => {
  cleanup()
})
