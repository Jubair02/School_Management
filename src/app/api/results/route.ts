import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parseBody } from "@/lib/api-utils";
import { gradeFor } from "@/lib/grade";

// GET /api/results?examId&subjectId — TEACHER, ADMIN
// Marks roster: ACTIVE students of the exam's class; marks null when not entered.
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req, ["TEACHER", "ADMIN"]);

  const examId = req.nextUrl.searchParams.get("examId")?.trim() || undefined;
  const subjectId = req.nextUrl.searchParams.get("subjectId")?.trim() || undefined;
  if (!examId) throw new ApiError(400, "examId is required");
  if (!subjectId) throw new ApiError(400, "subjectId is required");

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new ApiError(404, "Exam not found");

  const subject = await db.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw new ApiError(404, "Subject not found");
  if (subject.classId !== exam.classId) {
    throw new ApiError(400, "This subject does not belong to the exam's class");
  }

  const [students, results] = await Promise.all([
    db.student.findMany({
      where: { classId: exam.classId, status: "ACTIVE" },
      include: { user: { select: { name: true } } },
      orderBy: [{ rollNumber: "asc" }, { user: { name: "asc" } }],
    }),
    db.result.findMany({
      where: { examId, subjectId },
      select: { studentId: true, marks: true },
    }),
  ]);

  const byStudent = new Map(results.map((r) => [r.studentId, r.marks]));

  return NextResponse.json({
    examId,
    subjectId,
    records: students.map((s) => ({
      studentId: s.id,
      studentName: s.user.name,
      rollNumber: s.rollNumber,
      marks: byStudent.has(s.id) ? byStudent.get(s.id)! : null,
    })),
    enteredCount: results.length,
  });
});

const upsertSchema = z.object({
  examId: z.string().min(1, "examId is required"),
  subjectId: z.string().min(1, "subjectId is required"),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1, "studentId is required"),
        marks: z.number().min(0, "Marks cannot be negative").max(100, "Marks cannot exceed 100"),
      })
    )
    .min(1, "At least one mark entry is required"),
});

// POST /api/results — TEACHER, ADMIN — upsert marks (unique studentId+examId+subjectId), auto grade/GPA
export const POST = handle(async (req: NextRequest) => {
  await requireAuth(req, ["TEACHER", "ADMIN"]);
  const body = await parseBody(req, upsertSchema);

  const exam = await db.exam.findUnique({ where: { id: body.examId } });
  if (!exam) throw new ApiError(400, "Selected exam does not exist");

  const subject = await db.subject.findUnique({ where: { id: body.subjectId } });
  if (!subject) throw new ApiError(400, "Selected subject does not exist");
  if (subject.classId !== exam.classId) {
    throw new ApiError(400, "This subject does not belong to the exam's class");
  }

  const classStudents = await db.student.findMany({
    where: { classId: exam.classId },
    select: { id: true },
  });
  const classStudentIds = new Set(classStudents.map((s) => s.id));
  for (const entry of body.marks) {
    if (!classStudentIds.has(entry.studentId)) {
      throw new ApiError(400, "One or more students do not belong to the exam's class");
    }
  }

  await db.$transaction(async (tx) => {
    for (const entry of body.marks) {
      const { grade, gpa } = gradeFor(entry.marks);
      const existing = await tx.result.findUnique({
        where: { studentId_examId_subjectId: { studentId: entry.studentId, examId: body.examId, subjectId: body.subjectId } },
        select: { id: true },
      });
      if (existing) {
        await tx.result.update({
          where: { id: existing.id },
          data: { marks: entry.marks, grade, gpa },
        });
      } else {
        await tx.result.create({
          data: {
            studentId: entry.studentId,
            examId: body.examId,
            subjectId: body.subjectId,
            marks: entry.marks,
            grade,
            gpa,
          },
        });
      }
    }
  });

  return NextResponse.json({ saved: body.marks.length });
});
