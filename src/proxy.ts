import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Optimistic gate only (no database access, per Next.js guidance).
 * It improves UX by redirecting obviously signed-out visitors early.
 * Real authentication and authorization happen server-side in every page
 * and Server Action via src/server/auth/guards.ts.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!request.cookies.has(SESSION_COOKIE)) {
    const signIn = new URL("/sign-in", request.url);
    if (pathname.startsWith("/dashboard")) signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  // Always overwrite (never trust) this header so guards can build a safe
  // `?next=` when a stale cookie forces a sign-in.
  const headers = new Headers(request.headers);
  headers.set("x-vl-pathname", `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/onboarding"],
};
