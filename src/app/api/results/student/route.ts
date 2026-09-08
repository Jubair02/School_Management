import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireStudentAccess } from "@/lib/api-auth";
import { ApiError, getParentByUserId, getStudentByUserId, handle, q } from "@/lib/api-utils";
import { overallFor } from "@/lib/grade";

// GET /api/results/student?studentId&examId
// ADMIN/TEACHER any student; STUDENT self (studentId optional); PARENT own child (studentId required).
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);

  let studentId: string;

  if (auth.role === "ADMIN" || auth.role === "TEACHER") {
    const requested = q(req, "studentId");
    if (!requested) throw new ApiError(400, "studentId is required");
    // ADMIN: any student. TEACHER: only their own classes.
    await requireStudentAccess(auth, requested);
    studentId = requested;
  } else if (auth.role === "STUDENT") {
    const self = await getStudentByUserId(auth.id);
    if (!self) throw new ApiError(404, "Student profile not found");
    const requested = q(req, "studentId");
    if (requested && requested !== self.id) {
      throw new ApiError(403, "You can only view your own result sheet");
    }
    studentId = self.id;
  } else {
    // PARENT
    const requested = q(req, "studentId");
    if (!requested) throw new ApiError(400, "studentId is required");
    const parent = await getParentByUserId(auth.id);
    if (!parent) throw new ApiError(404, "Parent profile not found");
    const child = await db.student.findFirst({
      where: { id: requested, parentId: parent.id },
      select: { id: true },
    });
    if (!child) throw new ApiError(403, "You can only view your own child's result sheet");
    studentId = child.id;
  }

  const examId = q(req, "examId");
  if (!examId) throw new ApiError(400, "examId is required");

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  if (!student) throw new ApiError(404, "Student not found");

  const exam = await db.exam.findUnique({ where: { id: examId }, select: { id: true, name: true } });
  if (!exam) throw new ApiError(404, "Exam not found");

  const results = await db.result.findMany({
    where: { studentId, examId },
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  const overall = overallFor(results.map((r) => r.marks));

  return NextResponse.json({
    sheet: {
      student: {
        id: student.id,
        studentId: student.studentId,
        name: student.user.name,
        className: student.class?.name ?? "",
        sectionName: student.section?.name ?? null,
      },
      exam: { id: exam.id, name: exam.name },
      results: results.map((r) => ({
        subjectId: r.subject.id,
        subjectName: r.subject.name,
        subjectCode: r.subject.code,
        marks: r.marks,
        grade: r.grade,
        gpa: r.gpa,
      })),
      total: overall.total,
      average: overall.average,
      gpa: overall.gpa,
      overallGrade: overall.overallGrade,
    },
  });
});
