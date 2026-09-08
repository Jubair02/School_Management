import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** httpOnly session cookie name (shared with route handlers). */
export const COOKIE_NAME = "sms_token";

/** 7 days, in seconds. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const DEV_FALLBACK_SECRET = "edusphere-dev-secret-change-me";

let cachedKey: Uint8Array | null = null;
let warnedAboutFallback = false;

/**
 * Resolve the JWT signing key.
 *
 * Resolved lazily (per request, then cached) rather than at module load so a
 * missing AUTH_SECRET fails the request instead of the build. In production a
 * missing secret is fatal: falling back to a public constant would let anyone
 * mint a valid admin token.
 */
function getSecretKey(): Uint8Array {
  if (cachedKey) return cachedKey;

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET is not set. Refusing to sign or verify sessions with the " +
          "public development secret — set AUTH_SECRET in the environment."
      );
    }
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn("[auth] AUTH_SECRET is not set — using the development fallback secret.");
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

/**
 * Options shared by every write of the session cookie (set on login, cleared
 * on logout). `secure` is on in production so the cookie is never sent over
 * plain HTTP; it stays off locally where dev runs on http://localhost.
 */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export interface TokenPayload extends JWTPayload {
  sub: string;
  role: string;
  name: string;
  email: string;
}

export interface SignTokenInput {
  sub: string;
  role: string;
  name: string;
  email: string;
}

/** Sign an HS256 JWT with 7-day expiry. */
export async function signToken(payload: SignTokenInput): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

/** Verify a JWT; returns null when invalid/expired. */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  // Resolved outside the try: a missing AUTH_SECRET is a misconfiguration that
  // must surface as a 500, not be swallowed into a misleading "invalid session".
  const key = getSecretKey();
  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.sub) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
