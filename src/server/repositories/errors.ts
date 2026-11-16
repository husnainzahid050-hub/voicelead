import "server-only";
import { Prisma } from "@/generated/prisma/client";

/** True when a write failed because a @unique column already holds that value. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
