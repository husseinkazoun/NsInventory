import { Outlet } from 'react-router-dom'
import { AppShell } from './AppShell'

// Used as the `element` of a parent React Router route so all protected
// children render inside the shared AppShell (sidebar + header).
export function AppShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
