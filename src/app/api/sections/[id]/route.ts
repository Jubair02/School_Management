import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/sections/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.section.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Section not found");

  await db.section.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
