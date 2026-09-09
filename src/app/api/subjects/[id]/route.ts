import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import { ApiError, handle, parseBody, subjectInclude, toSubjectDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1, "Subject name is required").optional(),
  code: z.string().min(1, "Subject code is required").optional(),
  teacherId: z.string().nullable().optional(), // null → unassign teacher
});

// PUT /api/subjects/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.subject.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Subject not found");

  const data: { name?: string; code?: string; teacherId?: string | null } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.code !== undefined) data.code = body.code;
  if (body.teacherId === null) {
    data.teacherId = null;
  } else if (body.teacherId !== undefined) {
    const teacher = await db.teacher.findUnique({ where: { id: body.teacherId } });
    if (!teacher) throw new ApiError(400, "Selected teacher does not exist");
    data.teacherId = body.teacherId;
  }

  if (Object.keys(data).length > 0) {
    await db.subject.update({ where: { id }, data });
  }

  const updated = await db.subject.findUniqueOrThrow({ where: { id }, include: subjectInclude });
  const delta = diff(
    { name: existing.name, code: existing.code, teacherId: existing.teacherId },
    body as Record<string, unknown>
  );
  if (delta.changed.length > 0) {
    await recordAudit(req, actorOf(actor), {
      action: "UPDATE", entity: "Subject", entityId: id,
      summary: `Edited subject ${existing.name} — ${delta.changed.join(", ")}`,
      before: delta.before, after: delta.after,
    });
  }

  return NextResponse.json({ subject: toSubjectDTO(updated) });
});

// DELETE /api/subjects/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);

  const existing = await db.subject.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Subject not found");

  await db.subject.delete({ where: { id } });
  await recordAudit(req, actorOf(actor), {
    action: "DELETE", entity: "Subject", entityId: id,
    summary: `Deleted subject ${existing.name} (${existing.code}) and every result recorded against it`,
    before: { name: existing.name, code: existing.code, classId: existing.classId },
  });

  return NextResponse.json({ success: true });
});
