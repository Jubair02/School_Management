import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { COOKIE_NAME, SESSION_MAX_AGE, sessionCookieOptions, signToken } from "@/lib/auth";
import { ApiError, handle, parseBody, toPublicUser } from "@/lib/api-utils";
import { MINUTE_MS, enforceRateLimit } from "@/lib/rate-limit";

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
  if (!user) throw new ApiError(401, "Invalid email or password");

  const passwordOk = await bcrypt.compare(password, user.password);
  if (!passwordOk) throw new ApiError(401, "Invalid email or password");

  if (user.status === "INACTIVE") {
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
  const res = NextResponse.json({ user: toPublicUser(user) });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
