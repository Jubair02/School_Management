import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody } from "@/lib/api-utils";
import { MINUTE_MS, enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1, "Your current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

/**
 * POST /api/auth/change-password — any signed-in user.
 *
 * Previously no role could change its own password: the only routes were an
 * admin editing the record, or the reset-token flow. Requiring the current
 * password means a stolen session alone cannot lock the owner out.
 */
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);
  const body = await parseBody(req, schema);

  // Caps guessing of the current password from a hijacked session.
  enforceRateLimit(req, [
    { scope: "change-password", subject: auth.id, limit: 10, windowMs: 15 * MINUTE_MS },
  ]);

  const user = await db.user.findUnique({ where: { id: auth.id } });
  if (!user) throw new ApiError(401, "Session user no longer exists. Please log in again.");

  const currentOk = await bcrypt.compare(body.currentPassword, user.password);
  if (!currentOk) throw new ApiError(400, "Your current password is incorrect.");

  if (await bcrypt.compare(body.newPassword, user.password)) {
    throw new ApiError(400, "The new password must be different from the current one.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(body.newPassword, 10) },
  });

  // Note: existing JWTs stay valid until they expire — they carry no password
  // reference to invalidate. Session revocation would need a token version
  // column checked in requireAuth.
  return NextResponse.json({ success: true });
});
