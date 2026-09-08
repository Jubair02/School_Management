import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError, handle, parseBody } from "@/lib/api-utils";
import { HOUR_MS, enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const POST = handle(async (req: NextRequest) => {
  const { token, password } = await parseBody(req, schema);

  // Tokens are random UUIDs, so guessing is already impractical — this caps the
  // attempt rate anyway and keeps the endpoint from being a free write path.
  enforceRateLimit(req, [{ scope: "reset-ip", limit: 20, windowMs: HOUR_MS }]);

  const record = await db.passwordReset.findUnique({ where: { token } });
  if (!record) throw new ApiError(400, "Invalid reset token");
  if (record.used) throw new ApiError(400, "Reset token has already been used");
  if (record.expiresAt.getTime() < Date.now()) throw new ApiError(400, "Reset token has expired");

  const hashed = await bcrypt.hash(password, 10);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    db.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  return NextResponse.json({ success: true });
});
