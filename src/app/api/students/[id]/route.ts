import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ApiError,
  GENDERS,
  USER_STATUSES,
  attendanceCounts,
  computeGpaForStudent,
  dayStartUTC,
  handle,
  outstandingOf,
  parseBody,
  studentInclude,
  toStudentDTO,
} from "@/lib/api-utils";
import { overallFor } from "@/lib/grade";

type Ctx = { params: Promise<{ id: string }> };

async function loadStudent(id: string) {
  const student = await db.student.findUnique({ where: { id }, include: studentInclude });
  if (!student) throw new ApiError(404, "Student not found");
  return student;
}

// GET /api/students/[id] — ADMIN, TEACHER, STUDENT(self), PARENT(own child)
export const GET = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  const student = await loadStudent(id);

  if (auth.role === "STUDENT" && student.userId !== auth.id) {
    throw new ApiError(403, "You can only view your own record");
  }
  if (auth.role === "PARENT") {
    const parent = await db.parent.findUnique({ where: { userId: auth.id } });
    if (!parent || student.parentId !== parent.id) {
      throw new ApiError(403, "You can only view your own child's record");
    }
  }

  const [attRows, feeRows, resultRows] = await Promise.all([
    db.attendance.findMany({ where: { studentId: student.id }, select: { status: true } }),
    db.fee.findMany({ where: { studentId: student.id }, select: { amount: true, paidAmount: true } }),
    db.result.findMany({ where: { studentId: student.id }, select: { marks: true } }),
  ]);

  const dto = toStudentDTO(student);
  return NextResponse.json({
    student: {
      ...dto,
      attendanceSummary: attendanceCounts(attRows),
      feeSummary: {
        due: Math.round(feeRows.reduce((s, f) => s + outstandingOf(f.amount, f.paidAmount), 0) * 100) / 100,
        totalDue: Math.round(feeRows.reduce((s, f) => s + f.amount, 0) * 100) / 100,
      },
      gpa: resultRows.length > 0 ? overallFor(resultRows.map((r) => r.marks)).gpa : null,
    },
  });
});

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.email("A valid email is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  gender: z.enum(GENDERS).optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  parentId: z.string().optional(),
  rollNumber: z.string().optional(),
  status: z.enum(USER_STATUSES).optional(),
});

// PUT /api/students/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const student = await loadStudent(id);

  if (body.classId) {
    const cls = await db.class.findUnique({ where: { id: body.classId } });
    if (!cls) throw new ApiError(400, "Selected class does not exist");
  }
  if (body.sectionId) {
    const section = await db.section.findUnique({ where: { id: body.sectionId } });
    if (!section) throw new ApiError(400, "Selected section does not exist");
  }
  if (body.parentId) {
    const parent = await db.parent.findUnique({ where: { id: body.parentId } });
    if (!parent) throw new ApiError(400, "Selected parent does not exist");
  }

  const userData: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) userData.name = body.name;
  if (body.email !== undefined) userData.email = body.email.trim().toLowerCase();
  if (body.phone !== undefined) userData.phone = body.phone;
  if (body.password !== undefined) userData.password = await bcrypt.hash(body.password, 10);
  if (body.status !== undefined) userData.status = body.status;

  const studentData: Prisma.StudentUncheckedUpdateInput = {};
  if (body.rollNumber !== undefined) studentData.rollNumber = body.rollNumber;
  if (body.dateOfBirth !== undefined) studentData.dateOfBirth = dayStartUTC(body.dateOfBirth);
  if (body.gender !== undefined) studentData.gender = body.gender;
  if (body.address !== undefined) studentData.address = body.address;
  if (body.classId !== undefined) studentData.classId = body.classId;
  if (body.sectionId !== undefined) studentData.sectionId = body.sectionId;
  if (body.parentId !== undefined) studentData.parentId = body.parentId;
  if (body.status !== undefined) studentData.status = body.status;

  await db.$transaction(async (tx) => {
    if (Object.keys(studentData).length > 0) {
      await tx.student.update({ where: { id: student.id }, data: studentData });
    }
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: student.userId }, data: userData });
    }
  });

  const updated = await db.student.findUnique({ where: { id: student.id }, include: studentInclude });
  return NextResponse.json({ student: updated ? toStudentDTO(updated) : null });
});

// DELETE /api/students/[id] — ADMIN — soft delete (INACTIVE on User + Student)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const student = await loadStudent(id);
  await db.$transaction([
    db.user.update({ where: { id: student.userId }, data: { status: "INACTIVE" } }),
    db.student.update({ where: { id: student.id }, data: { status: "INACTIVE" } }),
  ]);

  return NextResponse.json({ success: true });
});
