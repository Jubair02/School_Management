import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handle, parseBody } from "@/lib/api-utils";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
});

// Dev-mode password reset: returns the token directly (no email delivery in MVP).
export const POST = handle(async (req: NextRequest) => {
  const { email } = await parseBody(req, schema);

  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new ApiError(404, "No account found with this email");

  const token = randomUUID();
  await db.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return NextResponse.json({ token, name: user.name });
});
