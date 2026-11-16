/**
 * Session cookie name, shared by proxy.ts and the session module.
 * `__Host-` prefix in production: the browser only accepts it over HTTPS,
 * with Path=/ and no Domain, so subdomains cannot set or overwrite it.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-vl_session" : "vl_session";
