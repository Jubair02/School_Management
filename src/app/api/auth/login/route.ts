import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { COOKIE_NAME, SESSION_MAX_AGE, sessionCookieOptions, signToken } from "@/lib/auth";
import { ApiError, handle, parseBody, toPublicUser } from "@/lib/api-utils";
import { MINUTE_MS, enforceRateLimit } from "@/lib/rate-limit";
import { anonymousActor, recordAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const POST = handle(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, schema);
  const normalizedEmail = email.trim().toLowerCase();

  // Two rules: one account cannot be hammered from a host, and one host cannot
  // spray many accounts. Counted before the password check so failures cost.
  enforceRateLimit(req, [
    { scope: "login", subject: normalizedEmail, limit: 10, windowMs: 15 * MINUTE_MS },
    { scope: "login-ip", limit: 50, windowMs: 15 * MINUTE_MS },
  ]);

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  // A failed attempt is logged against the address that was tried, not a user:
  // "someone tried to sign in as the principal 40 times" is exactly the pattern
  // an audit trail exists to surface.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    await recordAudit(req, user ? { id: user.id, name: user.name, role: user.role } : anonymousActor(), {
      action: "LOGIN_FAILED",
      entity: "Auth",
      entityId: user?.id ?? null,
      summary: `Failed sign-in attempt for ${normalizedEmail}`,
      after: { email: normalizedEmail, reason: user ? "wrong password" : "unknown account" },
    });
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status === "INACTIVE") {
    await recordAudit(req, { id: user.id, name: user.name, role: user.role }, {
      action: "LOGIN_FAILED",
      entity: "Auth",
      entityId: user.id,
      summary: `Blocked sign-in for deactivated account ${normalizedEmail}`,
      after: { email: normalizedEmail, reason: "account deactivated" },
    });
    throw new ApiError(403, "This account has been deactivated. Please contact the school office.");
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  // The token is deliberately NOT returned in the body. It lives only in the
  // httpOnly cookie below, so client-side script (and therefore any XSS) can
  // never read the session.
  await recordAudit(req, { id: user.id, name: user.name, role: user.role }, {
    action: "LOGIN",
    entity: "Auth",
    entityId: user.id,
    summary: `${user.name} signed in`,
  });

  const res = NextResponse.json({ user: toPublicUser(user) });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
