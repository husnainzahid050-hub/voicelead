import "server-only";
import { db } from "@/lib/db";

/**
 * User data access. Credentials are only ever read here and in the auth
 * service; nothing outside those two modules sees a password hash.
 */

export function findUserCredentialsByEmail(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, businessId: true },
  });
}

export function createOwnerUser(data: { name: string; email: string; passwordHash: string }) {
  return db.user.create({
    data: { ...data, role: "owner", businessId: null },
    select: { id: true },
  });
}
