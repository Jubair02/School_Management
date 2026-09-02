import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, EXAM_STATUSES, examInclude, handle, parseBody, requireDay, toExamDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1, "Exam name is required").optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  status: z.enum(EXAM_STATUSES).optional(),
});

// PUT /api/exams/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.exam.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Exam not found");

  const data: { name?: string; startDate?: Date; endDate?: Date; status?: string } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.startDate !== undefined) {
    requireDay(body.startDate, "startDate");
    data.startDate = new Date(`${body.startDate}T00:00:00.000Z`);
  }
  if (body.endDate !== undefined) {
    requireDay(body.endDate, "endDate");
    data.endDate = new Date(`${body.endDate}T00:00:00.000Z`);
  }
  if (body.status !== undefined) data.status = body.status;

  const start = data.startDate ?? existing.startDate;
  const end = data.endDate ?? existing.endDate;
  if (end.getTime() < start.getTime()) {
    throw new ApiError(400, "End date must be on or after start date");
  }

  if (Object.keys(data).length > 0) {
    await db.exam.update({ where: { id }, data });
  }

  const updated = await db.exam.findUniqueOrThrow({ where: { id }, include: examInclude });
  return NextResponse.json({ exam: toExamDTO(updated) });
});

// DELETE /api/exams/[id] — ADMIN (results cascade)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.exam.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Exam not found");

  await db.exam.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
