import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody, q, subjectInclude, toSubjectDTO } from "@/lib/api-utils";

// GET /api/subjects?classId — any logged-in user
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req);

  const classId = q(req, "classId");
  const rows = await db.subject.findMany({
    where: classId ? { classId } : {},
    include: subjectInclude,
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json({ subjects: rows.map(toSubjectDTO) });
});

const createSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(1, "Subject code is required"),
  classId: z.string().min(1, "classId is required"),
  teacherId: z.string().optional(),
});

// POST /api/subjects — ADMIN
export const POST = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const cls = await db.class.findUnique({ where: { id: body.classId } });
  if (!cls) throw new ApiError(400, "Selected class does not exist");

  if (body.teacherId) {
    const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
    if (!teacher) throw new ApiError(400, "Selected teacher does not exist");
  }

  const created = await db.subject.create({
    data: {
      name: body.name,
      code: body.code,
      classId: body.classId,
      teacherId: body.teacherId ?? null,
    },
  });

  const subject = await db.subject.findUniqueOrThrow({
    where: { id: created.id },
    include: subjectInclude,
  });
  return NextResponse.json({ subject: toSubjectDTO(subject) }, { status: 201 });
});
