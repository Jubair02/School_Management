import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, requireClassAccess } from "@/lib/api-auth";
import {
  ApiError,
  ATTENDANCE_STATUSES,
  dayRangeUTC,
  handle,
  parseBody,
  q,
  requireDay,
  todayISO,
} from "@/lib/api-utils";

// GET /api/attendance?classId&date=YYYY-MM-DD — TEACHER, ADMIN
// Roster of ACTIVE students in the class; status null when not yet marked.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req, ["TEACHER", "ADMIN"]);

  const classId = q(req, "classId");
  if (!classId) throw new ApiError(400, "classId is required");
  const dateStr = requireDay(q(req, "date") ?? todayISO(), "date");

  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls) throw new ApiError(404, "Class not found");

  await requireClassAccess(auth, classId);

  const range = dayRangeUTC(dateStr);

  const [students, records] = await Promise.all([
    db.student.findMany({
      where: { classId, status: "ACTIVE" },
      include: { user: { select: { name: true } } },
      orderBy: [{ rollNumber: "asc" }, { user: { name: "asc" } }],
    }),
    db.attendance.findMany({
      where: { classId, date: range },
      select: { studentId: true, status: true },
    }),
  ]);

  const byStudent = new Map(records.map((r) => [r.studentId, r.status as (typeof ATTENDANCE_STATUSES)[number]]));

  return NextResponse.json({
    classId,
    date: dateStr,
    records: students.map((s) => ({
      studentId: s.id,
      studentName: s.user.name,
      rollNumber: s.rollNumber,
      status: byStudent.get(s.id) ?? null,
    })),
    markedCount: byStudent.size,
  });
});

const upsertSchema = z.object({
  classId: z.string().min(1, "classId is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1, "studentId is required"),
        // null = "not marked": deletes any existing record for that day. The UI
        // could previously only overwrite a status, never take one back, so a
        // mistaken absence was permanent.
        status: z.enum(ATTENDANCE_STATUSES).nullable(),
      })
    )
    .min(1, "At least one attendance record is required"),
});

// POST /api/attendance — TEACHER, ADMIN — upsert (unique studentId + day)
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req, ["TEACHER", "ADMIN"]);
  const body = await parseBody(req, upsertSchema);

  const cls = await db.class.findUnique({ where: { id: body.classId } });
  if (!cls) throw new ApiError(400, "Selected class does not exist");

  await requireClassAccess(auth, body.classId);

  // Normalize to UTC midnight — the [studentId, date] unique key is stable per day.
  const dayUTC = new Date(`${body.date}T00:00:00.000Z`);
  const range = dayRangeUTC(body.date);

  const classStudents = await db.student.findMany({
    where: { classId: body.classId },
    select: { id: true },
  });
  const classStudentIds = new Set(classStudents.map((s) => s.id));
  for (const record of body.records) {
    if (!classStudentIds.has(record.studentId)) {
      throw new ApiError(400, "One or more students do not belong to this class");
    }
  }

  let saved = 0;
  let cleared = 0;

  await db.$transaction(async (tx) => {
    for (const record of body.records) {
      // Match any existing record within the same UTC day (tolerates legacy timestamps).
      const existing = await tx.attendance.findFirst({
        where: { studentId: record.studentId, date: range },
        select: { id: true },
      });

      if (record.status === null) {
        if (existing) {
          await tx.attendance.delete({ where: { id: existing.id } });
          cleared += 1;
        }
        continue;
      }

      if (existing) {
        await tx.attendance.update({
          where: { id: existing.id },
          data: {
            date: dayUTC,
            status: record.status,
            classId: body.classId,
            markedById: auth.id,
          },
        });
      } else {
        await tx.attendance.create({
          data: {
            studentId: record.studentId,
            classId: body.classId,
            date: dayUTC,
            status: record.status,
            markedById: auth.id,
          },
        });
      }
      saved += 1;
    }
  });

  return NextResponse.json({ saved, cleared });
});
