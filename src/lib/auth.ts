import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** httpOnly session cookie name (shared with route handlers). */
export const COOKIE_NAME = "sms_token";

/** 7 days, in seconds. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const secretKey = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "edusphere-dev-secret-change-me"
);

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
    .sign(secretKey);
}

/** Verify a JWT; returns null when invalid/expired. */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.sub) return null;
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
