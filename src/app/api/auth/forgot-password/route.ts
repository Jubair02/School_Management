import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, parseBody } from "@/lib/api-utils";
import { HOUR_MS, enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
});

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Request a password reset.
 *
 * The response is deliberately uniform: the same 200 and the same body are
 * returned whether or not the address belongs to an account, so this endpoint
 * cannot be used to discover which emails are registered.
 *
 * Outside production the freshly minted token is included in the response so
 * the local reset flow stays usable without a mail server. In production the
 * token is NEVER returned — handing an anonymous caller a reset token for an
 * arbitrary address is a complete account takeover. Delivery must go through
 * an email provider before self-service reset can be enabled in production;
 * until then, an admin sets passwords via PUT /api/students|teachers/[id].
 */
export const POST = handle(async (req: NextRequest) => {
  const { email } = await parseBody(req, schema);
  const normalizedEmail = email.trim().toLowerCase();

  enforceRateLimit(req, [
    { scope: "forgot", subject: normalizedEmail, limit: 3, windowMs: HOUR_MS },
    { scope: "forgot-ip", limit: 10, windowMs: HOUR_MS },
  ]);

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  // Nothing to hand back in production, so don't create a token there either:
  // an unauthenticated endpoint that writes a row per call is a free way to
  // grow the table without bound.
  if (!user || IS_PRODUCTION) {
    return NextResponse.json({ success: true, delivered: false });
  }

  const token = randomUUID();
  await db.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return NextResponse.json({ success: true, delivered: true, token, name: user.name });
});
