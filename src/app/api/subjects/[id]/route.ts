import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody, subjectInclude, toSubjectDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1, "Subject name is required").optional(),
  code: z.string().min(1, "Subject code is required").optional(),
  teacherId: z.string().nullable().optional(), // null → unassign teacher
});

// PUT /api/subjects/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.subject.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Subject not found");

  const data: { name?: string; code?: string; teacherId?: string | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.code !== undefined) data.code = body.code;
  if (body.teacherId === null) {
    data.teacherId = null;
  } else if (body.teacherId !== undefined) {
    const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
    if (!teacher) throw new ApiError(400, "Selected teacher does not exist");
    data.teacherId = body.teacherId;
  }

  if (Object.keys(data).length > 0) {
    await db.subject.update({ where: { id }, data });
  }

  const updated = await db.subject.findUniqueOrThrow({ where: { id }, include: subjectInclude });
  return NextResponse.json({ subject: toSubjectDTO(updated) });
});

// DELETE /api/subjects/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.subject.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Subject not found");

  await db.subject.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
