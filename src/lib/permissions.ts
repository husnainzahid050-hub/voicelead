import type { UserRole } from "@/types/domain";

/**
 * Role-based access control matrix. The server enforces this on every
 * protected operation; the UI uses the same table only to decide what to show.
 */
const PERMISSIONS = {
  "leads:read": ["owner", "staff"],
  "leads:update": ["owner", "staff"],
  "leads:delete": ["owner"],
  "intake-link:read": ["owner", "staff"],
  "settings:read": ["owner"],
  "settings:update": ["owner"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function can(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}
