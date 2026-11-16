import type { UserRole } from "@/types/domain";

/** The signed-in user, as resolved from the session on the server. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string | null;
}

/**
 * Authorization context for every protected operation. Built only from the
 * server-side session — never from client input — and passed to repositories,
 * which scope every query by `businessId`.
 */
export interface AuthContext {
  userId: string;
  businessId: string;
  role: UserRole;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
