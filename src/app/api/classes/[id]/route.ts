import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import { ApiError, classInclude, handle, parseBody, toClassDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

// PUT /api/classes/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);

  const schema = z.object({
    name: z.string().min(1, "Class name is required").optional(),
    academicYear: z.string().min(1, "Academic year is required").optional(),
  });
  const body = await parseBody(req, schema);

  const existing = await db.class.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Class not found");

  const data: { name?: string; academicYear?: string } = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.academicYear !== undefined) data.academicYear = body.academicYear;
  if (Object.keys(data).length > 0) {
    await db.class.update({ where: { id }, data });
  }

  const updated = await db.class.findUniqueOrThrow({ where: { id }, include: classInclude });
  const delta = diff(
    { name: existing.name, academicYear: existing.academicYear },
    body as Record<string, unknown>
  );
  if (delta.changed.length > 0) {
    await recordAudit(req, actorOf(actor), {
      action: "UPDATE", entity: "Class", entityId: id,
      summary: `Edited class ${existing.name} — ${delta.changed.join(", ")}`,
      before: delta.before, after: delta.after,
    });
  }

  return NextResponse.json({ class: toClassDTO(updated) });
});

// DELETE /api/classes/[id] — ADMIN — hard delete (relations cascade / detach per schema)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);

  const existing = await db.class.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Class not found");

  await db.class.delete({ where: { id } });
  // Cascades through sections, subjects, exams, results, attendance and
  // timetable — the highest-consequence single action in the product.
  await recordAudit(req, actorOf(actor), {
    action: "DELETE", entity: "Class", entityId: id,
    summary: `Deleted class ${existing.name} and all of its sections, subjects, exams, results, attendance and timetable`,
    before: { name: existing.name, academicYear: existing.academicYear },
  });

  return NextResponse.json({ success: true });
});
