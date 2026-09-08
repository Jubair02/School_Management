import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1, "Section name is required"),
});

// PUT /api/sections/[id] — ADMIN — rename. Previously a mistyped section name
// could only be fixed by deleting it, which unlinks its students.
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.section.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Section not found");

  const name = body.name.trim();
  const clash = await db.section.findFirst({
    where: { classId: existing.classId, name, id: { not: id } },
    select: { id: true },
  });
  if (clash) throw new ApiError(400, "This class already has a section with that name");

  const section = await db.section.update({ where: { id }, data: { name } });
  return NextResponse.json({
    section: { id: section.id, name: section.name, classId: section.classId },
  });
});

// DELETE /api/sections/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.section.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Section not found");

  await db.section.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
