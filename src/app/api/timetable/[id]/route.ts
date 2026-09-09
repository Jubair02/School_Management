import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import {
  ApiError,
  WEEK_DAYS,
  handle,
  minutesOfDay,
  parseBody,
  timetableInclude,
  toTimetableDTO,
} from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  day: z.enum(WEEK_DAYS).optional(),
  period: z.number().int().min(1, "Period must be at least 1").max(15, "Period must be 15 or less").optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be in HH:MM format").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be in HH:MM format").optional(),
  subjectId: z.string().min(1).optional(),
  teacherId: z.string().nullable().optional(),
});

// PUT /api/timetable/[id] — ADMIN — edit a slot in place instead of
// delete-and-recreate.
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.timetable.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Timetable entry not found");

  const day = body.day ?? existing.day;
  const period = body.period ?? existing.period;
  const startTime = body.startTime ?? existing.startTime;
  const endTime = body.endTime ?? existing.endTime;

  const start = minutesOfDay(startTime);
  const end = minutesOfDay(endTime);
  if (start === null) throw new ApiError(400, "startTime must be a valid time between 00:00 and 23:59");
  if (end === null) throw new ApiError(400, "endTime must be a valid time between 00:00 and 23:59");
  if (end <= start) throw new ApiError(400, "endTime must be later than startTime");

  if (body.subjectId) {
    const subject = await db.subject.findUnique({ where: { id: body.subjectId } });
    if (!subject) throw new ApiError(400, "Selected subject does not exist");
    if (subject.classId !== existing.classId) {
      throw new ApiError(400, "This subject does not belong to the entry's class");
    }
  }
  if (body.teacherId) {
    const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
    if (!teacher) throw new ApiError(400, "Selected teacher does not exist");
  }

  // Moving the entry must not land on a slot another entry already holds.
  if (day !== existing.day || period !== existing.period) {
    const clash = await db.timetable.findFirst({
      where: { classId: existing.classId, day, period, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      throw new ApiError(400, "This timetable slot is already occupied for this class, day and period");
    }
  }

  await db.timetable.update({
    where: { id },
    data: {
      day,
      period,
      startTime,
      endTime,
      ...(body.subjectId !== undefined ? { subjectId: body.subjectId } : {}),
      ...(body.teacherId !== undefined ? { teacherId: body.teacherId } : {}),
    },
  });

  const entry = await db.timetable.findUniqueOrThrow({ where: { id }, include: timetableInclude });
  const delta = diff(
    {
      day: existing.day, period: existing.period, startTime: existing.startTime,
      endTime: existing.endTime, subjectId: existing.subjectId, teacherId: existing.teacherId,
    },
    { day, period, startTime, endTime, subjectId: body.subjectId, teacherId: body.teacherId }
  );
  if (delta.changed.length > 0) {
    await recordAudit(req, actorOf(actor), {
      action: "UPDATE", entity: "Timetable", entityId: id,
      summary: `Edited timetable slot ${day} period ${period} — ${delta.changed.join(", ")}`,
      before: delta.before, after: delta.after,
    });
  }

  return NextResponse.json({ entry: toTimetableDTO(entry) });
});

// DELETE /api/timetable/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);

  const existing = await db.timetable.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Timetable entry not found");

  await db.timetable.delete({ where: { id } });
  await recordAudit(req, actorOf(actor), {
    action: "DELETE", entity: "Timetable", entityId: id,
    summary: `Removed timetable slot ${existing.day} period ${existing.period}`,
    before: { day: existing.day, period: existing.period, classId: existing.classId },
  });

  return NextResponse.json({ success: true });
});
