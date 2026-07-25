import { useCurrentOrg } from './orgContext'
import type { OrgRole } from './org'

/**
 * Role capabilities, mirroring the database policy matrix.
 *
 * These drive UX only — which buttons are worth showing. The database is the
 * security boundary: `20260725161641_role_based_rls.sql` enforces the same
 * matrix in RLS, so hiding a control here never *grants* anything, and a user
 * who reaches a hidden action by URL is still refused by Postgres.
 *
 * Keep this table in step with the migration. If the two ever disagree, the
 * migration wins and the UI is merely wrong, not insecure.
 */
export type Capabilities = {
  /** Read organization data. */
  canRead: boolean
  /** Create or update operational data (lab assets, scans, components). */
  canWrite: boolean
  /** Delete operational data. */
  canDelete: boolean
}

export const ROLE_CAPABILITIES: Record<OrgRole, Capabilities> = {
  owner:  { canRead: true, canWrite: true,  canDelete: true },
  admin:  { canRead: true, canWrite: true,  canDelete: true },
  member: { canRead: true, canWrite: true,  canDelete: false },
  viewer: { canRead: true, canWrite: false, canDelete: false },
}

/** Nothing is permitted until an organization and role are resolved. */
export const NO_CAPABILITIES: Capabilities = {
  canRead: false,
  canWrite: false,
  canDelete: false,
}

export function capabilitiesFor(role: OrgRole | null | undefined): Capabilities {
  if (!role) return NO_CAPABILITIES
  return ROLE_CAPABILITIES[role] ?? NO_CAPABILITIES
}

/**
 * Capabilities for the active organization.
 *
 * Demo mode has no tenancy and no database behind it, so it shows the full
 * interface — it exists for design review, not for access control.
 */
export function useCapabilities(): Capabilities {
  const org = useCurrentOrg()
  if (org.status === 'demo') return ROLE_CAPABILITIES.owner
  if (org.status === 'ready') return capabilitiesFor(org.membership.role)
  return NO_CAPABILITIES
}
