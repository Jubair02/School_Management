import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ApiError,
  USER_STATUSES,
  handle,
  parseBody,
  teacherInclude,
  toTeacherDTO,
} from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

async function loadTeacher(id: string) {
  const teacher = await db.teacher.findUnique({ where: { id }, include: teacherInclude });
  if (!teacher) throw new ApiError(404, "Teacher not found");
  return teacher;
}

// GET /api/teachers/[id] — ADMIN, TEACHER
export const GET = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN", "TEACHER"]);
  const teacher = await loadTeacher(id);
  return NextResponse.json({ teacher: toTeacherDTO(teacher) });
});

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.email("A valid email is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  status: z.enum(USER_STATUSES).optional(),
});

// PUT /api/teachers/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const teacher = await loadTeacher(id);

  const userData: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) userData.name = body.name;
  if (body.email !== undefined) userData.email = body.email.trim().toLowerCase();
  if (body.phone !== undefined) userData.phone = body.phone;
  if (body.password !== undefined) userData.password = await bcrypt.hash(body.password, 10);
  if (body.status !== undefined) userData.status = body.status;

  const teacherData: Prisma.TeacherUpdateInput = {};
  if (body.department !== undefined) teacherData.department = body.department;
  if (body.joiningDate !== undefined)
    teacherData.joiningDate = new Date(`${body.joiningDate}T00:00:00.000Z`);
  if (body.status !== undefined) teacherData.status = body.status;

  await db.$transaction(async (tx) => {
    if (Object.keys(teacherData).length > 0) {
      await tx.teacher.update({ where: { id: teacher.id }, data: teacherData });
    }
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: teacher.userId }, data: userData });
    }
  });

  const updated = await db.teacher.findUnique({ where: { id: teacher.id }, include: teacherInclude });
  return NextResponse.json({ teacher: updated ? toTeacherDTO(updated) : null });
});

// DELETE /api/teachers/[id] — ADMIN — soft delete
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const teacher = await loadTeacher(id);
  await db.$transaction([
    db.user.update({ where: { id: teacher.userId }, data: { status: "INACTIVE" } }),
    db.teacher.update({ where: { id: teacher.id }, data: { status: "INACTIVE" } }),
  ]);

  return NextResponse.json({ success: true });
});
