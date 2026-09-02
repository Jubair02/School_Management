import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody, q } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const assignSchema = z.object({
  teacherId: z.string().min(1, "teacherId is required"),
});

// POST /api/classes/[id]/teachers — ADMIN — assign class teacher (TeacherClass)
export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, assignSchema);

  const cls = await db.class.findUnique({ where: { id } });
  if (!cls) throw new ApiError(404, "Class not found");

  const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
  if (!teacher) throw new ApiError(404, "Teacher not found");

  await db.teacherClass.create({ data: { teacherId: teacher.id, classId: id } });
  return NextResponse.json({ success: true }, { status: 201 });
});

// DELETE /api/classes/[id]/teachers?teacherId= — ADMIN — remove assignment
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const teacherId = q(req, "teacherId");
  if (!teacherId) throw new ApiError(400, "teacherId query parameter is required");

  const assignment = await db.teacherClass.findUnique({
    where: { teacherId_classId: { teacherId, classId: id } },
  });
  if (!assignment) throw new ApiError(404, "This teacher is not assigned to this class");

  await db.teacherClass.delete({ where: { id: assignment.id } });
  return NextResponse.json({ success: true });
});
