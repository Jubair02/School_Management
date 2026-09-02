import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { COOKIE_NAME, SESSION_MAX_AGE, signToken } from "@/lib/auth";
import { ApiError, handle, parseBody, toPublicUser } from "@/lib/api-utils";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

export const POST = handle(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, schema);

  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
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

  const res = NextResponse.json({ user: toPublicUser(user) });
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
