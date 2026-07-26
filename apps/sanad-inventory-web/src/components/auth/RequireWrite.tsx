import { type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { Button } from '../ui/Button'
import { useCapabilities } from '../../lib/permissions'

/**
 * Hides a page that only exists to create or change data from a role that
 * cannot do so.
 *
 * This is a UX affordance, not a security control: the database refuses the
 * write either way (see `20260725161641_role_based_rls.sql`). Its purpose is
 * to explain *why* rather than let someone fill in a form and then be handed
 * a permission error on submit.
 */
export function RequireWrite({ children }: { children: ReactNode }) {
  const { canWrite } = useCapabilities()

  if (canWrite) return <>{children}</>

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Eye className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-semibold text-ns-navy">Read-only access</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your role in this organization allows viewing inventory but not adding
        or changing it. Ask an owner or administrator if you need to make
        changes.
      </p>
      <div className="mt-6">
        <Button to="/lab-assets" variant="secondary">
          Back to Lab Assets
        </Button>
      </div>
    </div>
  )
}
