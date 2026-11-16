import { can, type Permission } from "@/lib/permissions";
import { ForbiddenError, type AuthContext } from "./types";

/**
 * Permission check for services and Server Actions. Throws rather than
 * returning a boolean so a forgotten `if` can never silently allow access.
 */
export function authorize(ctx: AuthContext, permission: Permission): void {
  if (!can(ctx.role, permission)) throw new ForbiddenError();
}
