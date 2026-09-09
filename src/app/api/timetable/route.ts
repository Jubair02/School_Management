import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, recordAudit } from "@/lib/audit";
import {
  ApiError,
  WEEK_DAYS,
  handle,
  minutesOfDay,
  parseBody,
  q,
  sortTimetable,
  timetableInclude,
  toTimetableDTO,
} from "@/lib/api-utils";

// GET /api/timetable?classId — any logged-in user; sorted SUN..THU then period
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req);

  const classId = q(req, "classId");
  if (!classId) throw new ApiError(400, "classId is required");

  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls) throw new ApiError(404, "Class not found");

  const rows = await db.timetable.findMany({
    where: { classId },
    include: timetableInclude,
  });

  return NextResponse.json({ entries: sortTimetable(rows).map(toTimetableDTO) });
});

const createSchema = z.object({
  classId: z.string().min(1, "classId is required"),
  day: z.enum(WEEK_DAYS),
  period: z.number().int().min(1, "Period must be at least 1").max(15, "Period must be 15 or less"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be in HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be in HH:MM format"),
  subjectId: z.string().min(1, "subjectId is required"),
  teacherId: z.string().optional(),
});

// POST /api/timetable — ADMIN
export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const cls = await db.class.findUnique({ where: { id: body.classId } });
  if (!cls) throw new ApiError(400, "Selected class does not exist");

  const subject = await db.subject.findUnique({ where: { id: body.subjectId } });
  if (!subject) throw new ApiError(400, "Selected subject does not exist");

  if (body.teacherId) {
    const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
    if (!teacher) throw new ApiError(400, "Selected teacher does not exist");
  }

  // The regex only proves the shape is HH:MM — these check it is a real time
  // and that the period does not end before (or when) it starts.
  const start = minutesOfDay(body.startTime);
  const end = minutesOfDay(body.endTime);
  if (start === null) throw new ApiError(400, "startTime must be a valid time between 00:00 and 23:59");
  if (end === null) throw new ApiError(400, "endTime must be a valid time between 00:00 and 23:59");
  if (end <= start) throw new ApiError(400, "endTime must be later than startTime");

  const clash = await db.timetable.findFirst({
    where: { classId: body.classId, day: body.day, period: body.period },
  });
  if (clash) {
    throw new ApiError(400, "This timetable slot is already occupied for this class, day and period");
  }

  const created = await db.timetable.create({
    data: {
      classId: body.classId,
      day: body.day,
      period: body.period,
      startTime: body.startTime,
      endTime: body.endTime,
      subjectId: body.subjectId,
      teacherId: body.teacherId ?? null,
    },
  });

  const entry = await db.timetable.findUniqueOrThrow({
    where: { id: created.id },
    include: timetableInclude,
  });
  await recordAudit(req, actorOf(actor), {
    action: "CREATE", entity: "Timetable", entityId: created.id,
    summary: `Added ${subject.name} to ${cls.name} on ${body.day} period ${body.period}`,
    after: { class: cls.name, day: body.day, period: body.period, subject: subject.name },
  });

  return NextResponse.json({ entry: toTimetableDTO(entry) }, { status: 201 });
});
