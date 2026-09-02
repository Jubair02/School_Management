import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { handle } from "@/lib/api-utils";

export const GET = handle(async (req: NextRequest) => {
  const user = await requireAuth(req);
  return NextResponse.json({ user });
});
