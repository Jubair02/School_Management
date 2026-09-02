import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, attendanceCounts, handle, getParentByUserId, getStudentByUserId, q } from "@/lib/api-utils";

// GET /api/attendance/summary?studentId
// ADMIN/TEACHER any student (studentId required); STUDENT self (studentId optional);
// PARENT own child (studentId required).
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);

  let studentId: string;

  if (auth.role === "ADMIN" || auth.role === "TEACHER") {
    const requested = q(req, "studentId");
    if (!requested) throw new ApiError(400, "studentId is required");
    studentId = requested;
  } else if (auth.role === "STUDENT") {
    const self = await getStudentByUserId(auth.id);
    if (!self) throw new ApiError(404, "Student profile not found");
    const requested = q(req, "studentId");
    if (requested && requested !== self.id) {
      throw new ApiError(403, "You can only view your own attendance summary");
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
    if (!child) throw new ApiError(403, "You can only view your own child's attendance summary");
    studentId = child.id;
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) throw new ApiError(404, "Student not found");

  const [rows, recentRows] = await Promise.all([
    db.attendance.findMany({ where: { studentId }, select: { status: true } }),
    db.attendance.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      take: 30,
      select: { date: true, status: true },
    }),
  ]);

  return NextResponse.json({
    ...attendanceCounts(rows),
    recent: recentRows.map((r) => ({ date: r.date.toISOString(), status: r.status })),
  });
});
