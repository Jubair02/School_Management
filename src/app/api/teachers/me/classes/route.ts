import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, getTeacherClassIds, handle, naturalCompare } from "@/lib/api-utils";

// GET /api/teachers/me/classes — TEACHER
// Classes where the teacher teaches a subject OR is class teacher.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req, ["TEACHER"]);

  const teacher = await db.teacher.findUnique({ where: { userId: auth.id } });
  if (!teacher) throw new ApiError(404, "Teacher profile not found");

  const classIds = await getTeacherClassIds(teacher.id);
  const classes = await db.class.findMany({
    where: { id: { in: classIds } },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          students: { where: { status: "ACTIVE" } },
          subjects: true,
        },
      },
    },
  });

  const payload = classes
    .map((c) => ({
      id: c.id,
      name: c.name,
      studentCount: c._count.students,
      subjectCount: c._count.subjects,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));

  // `teacherId` is the Teacher record id — the value that DTOs such as
  // SubjectDTO.teacher.id and TimetableEntryDTO.teacher.id carry. It is NOT the
  // User id, so the client needs it explicitly to recognise its own rows.
  return NextResponse.json({ teacherId: teacher.id, classes: payload });
});
