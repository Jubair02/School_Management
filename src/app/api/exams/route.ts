import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, EXAM_STATUSES, examInclude, handle, parseBody, q, requireDay, toExamDTO } from "@/lib/api-utils";

// GET /api/exams?classId — any logged-in user
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req);

  const classId = q(req, "classId");
  const rows = await db.exam.findMany({
    where: classId ? { classId } : {},
    include: examInclude,
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ exams: rows.map(toExamDTO) });
});

const createSchema = z.object({
  name: z.string().min(1, "Exam name is required"),
  classId: z.string().min(1, "classId is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

// POST /api/exams — ADMIN
export const POST = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const cls = await db.class.findUnique({ where: { id: body.classId } });
  if (!cls) throw new ApiError(400, "Selected class does not exist");

  requireDay(body.startDate, "startDate");
  requireDay(body.endDate, "endDate");
  const start = new Date(`${body.startDate}T00:00:00.000Z`);
  const end = new Date(`${body.endDate}T00:00:00.000Z`);
  if (end.getTime() < start.getTime()) {
    throw new ApiError(400, "End date must be on or after start date");
  }

  const created = await db.exam.create({
    data: {
      name: body.name,
      classId: body.classId,
      startDate: start,
      endDate: end,
      status: "SCHEDULED",
    },
  });

  const exam = await db.exam.findUniqueOrThrow({ where: { id: created.id }, include: examInclude });
  return NextResponse.json({ exam: toExamDTO(exam) }, { status: 201 });
});
