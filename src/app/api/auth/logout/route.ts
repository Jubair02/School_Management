import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { handle } from "@/lib/api-utils";

export const POST = handle(async () => {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
});
