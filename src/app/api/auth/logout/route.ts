import { NextResponse } from "next/server";
import { COOKIE_NAME, sessionCookieOptions } from "@/lib/auth";
import { handle } from "@/lib/api-utils";

export const POST = handle(async () => {
  const res = NextResponse.json({ success: true });
  // Same attributes as the login cookie — a browser only overwrites a cookie
  // when name/path/secure line up.
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    ...sessionCookieOptions,
    maxAge: 0,
  });
  return res;
});
