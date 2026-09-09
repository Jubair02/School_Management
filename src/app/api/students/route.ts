import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, teacherClassIdsFor } from "@/lib/api-auth";
import { actorOf, diff, recordAudit, safePayload } from "@/lib/audit";
import {
  ApiError,
  GENDERS,
  USER_STATUSES,
  dayStartUTC,
  handle,
  nextStudentCode,
  pagination,
  parseBody,
  q,
  toStudentDTO,
  studentInclude,
} from "@/lib/api-utils";

// GET /api/students?query&classId&sectionId&status&page&pageSize — ADMIN, TEACHER
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req, ["ADMIN", "TEACHER"]);

  const { page, pageSize, skip, take } = pagination(req);
  const query = q(req, "query");
  const classId = q(req, "classId");
  const sectionId = q(req, "sectionId");
  const status = q(req, "status");

  // A teacher sees only students in classes they teach. An explicit classId is
  // checked against that set; without one the whole result is narrowed to it,
  // so an unfiltered list can never expose the rest of the school.
  let classScope: Prisma.StudentWhereInput = classId ? { classId } : {};
  if (auth.role === "TEACHER") {
    const allowed = await teacherClassIdsFor(auth.id);
    if (classId) {
      if (!allowed.includes(classId)) throw new ApiError(403, "You do not teach this class.");
    } else {
      classScope = { classId: { in: allowed } };
    }
  }

  const where: Prisma.StudentWhereInput = {
    ...classScope,
    ...(sectionId ? { sectionId } : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { user: { name: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
            { studentId: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.student.findMany({
      where,
      include: studentInclude,
      orderBy: { studentId: "asc" },
      skip,
      take,
    }),
    db.student.count({ where }),
  ]);

  return NextResponse.json({ students: rows.map(toStudentDTO), total, page, pageSize });
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("A valid email is required"),
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

// POST /api/students — ADMIN — creates User (role STUDENT) + Student
export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

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

  const studentCode = await nextStudentCode();

  // Default roll number: per-class sequence when a class is chosen, else global.
  let rollNumber = body.rollNumber;
  if (!rollNumber) {
    const count = await db.student.count({
      where: body.classId ? { classId: body.classId } : {},
    });
    rollNumber = String(count + 1).padStart(2, "0");
  }

  const hashed = await bcrypt.hash(body.password ?? "Student@123", 10);

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: body.name,
        email: body.email.trim().toLowerCase(),
        password: hashed,
        role: "STUDENT",
        phone: body.phone ?? null,
        status: body.status ?? "ACTIVE",
      },
    });
    const student = await tx.student.create({
      data: {
        userId: user.id,
        studentId: studentCode,
        rollNumber,
        dateOfBirth: body.dateOfBirth ? dayStartUTC(body.dateOfBirth) : null,
        gender: body.gender ?? null,
        address: body.address ?? null,
        classId: body.classId ?? null,
        sectionId: body.sectionId ?? null,
        parentId: body.parentId ?? null,
        status: body.status ?? "ACTIVE",
      },
    });
    return student;
  });

  const student = await db.student.findUnique({ where: { id: created.id }, include: studentInclude });
  await recordAudit(req, actorOf(actor), {
    action: "CREATE", entity: "Student", entityId: created.id,
    summary: `Enrolled student ${body.name} (${studentCode})`,
    after: safePayload({ ...body, studentId: studentCode, rollNumber }),
  });

  return NextResponse.json({ student: student ? toStudentDTO(student) : null }, { status: 201 });
});
