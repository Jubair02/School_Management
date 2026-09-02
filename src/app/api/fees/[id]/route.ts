import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/fees/[id] — ADMIN (payments cascade)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.fee.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Fee not found");

  await db.fee.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
