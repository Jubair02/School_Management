import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  USER_STATUSES,
  handle,
  nextTeacherCode,
  optionalDay,
  parseBody,
  q,
  teacherInclude,
  toTeacherDTO,
} from "@/lib/api-utils";

// GET /api/teachers?query&status — ADMIN, TEACHER
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN", "TEACHER"]);

  const query = q(req, "query");
  const status = q(req, "status");

  const where: Prisma.TeacherWhereInput = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { user: { name: { contains: query } } },
            { user: { email: { contains: query } } },
            { teacherId: { contains: query } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.teacher.findMany({ where, include: teacherInclude, orderBy: { teacherId: "asc" } }),
    db.teacher.count({ where }),
  ]);

  return NextResponse.json({ teachers: rows.map(toTeacherDTO), total });
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("A valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  status: z.enum(USER_STATUSES).optional(),
});

// POST /api/teachers — ADMIN — creates User (role TEACHER) + Teacher
export const POST = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const teacherCode = await nextTeacherCode();
  const hashed = await bcrypt.hash(body.password ?? "Teacher@123", 10);
  const joiningDate = optionalDay(body.joiningDate, "joiningDate");

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: body.name,
        email: body.email.trim().toLowerCase(),
        password: hashed,
        role: "TEACHER",
        phone: body.phone ?? null,
        status: body.status ?? "ACTIVE",
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        userId: user.id,
        teacherId: teacherCode,
        department: body.department ?? null,
        joiningDate: joiningDate ? new Date(`${joiningDate}T00:00:00.000Z`) : undefined,
        status: body.status ?? "ACTIVE",
      },
    });
    return teacher;
  });

  const teacher = await db.teacher.findUnique({ where: { id: created.id }, include: teacherInclude });
  return NextResponse.json({ teacher: teacher ? toTeacherDTO(teacher) : null }, { status: 201 });
});
