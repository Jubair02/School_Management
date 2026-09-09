import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import {
  ApiError,
  AUDIENCES,
  announcementInclude,
  handle,
  parseBody,
  toAnnouncementDTO,
} from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  content: z.string().min(1, "Content is required").optional(),
  targetAudience: z.enum(AUDIENCES).optional(),
  classId: z.string().nullable().optional(),
});

// PUT /api/announcements/[id] — ADMIN — announcements were create/delete only,
// so fixing a typo meant deleting and re-publishing.
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Announcement not found");

  const audience = body.targetAudience ?? existing.targetAudience;
  const classId = body.classId !== undefined ? body.classId : existing.classId;

  if (audience === "SPECIFIC_CLASS") {
    if (!classId) throw new ApiError(400, "Select a class for a class-specific announcement");
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls) throw new ApiError(400, "Selected class does not exist");
  }

  await db.announcement.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      targetAudience: audience,
      // A non-class audience must not keep a stale classId behind it.
      classId: audience === "SPECIFIC_CLASS" ? classId : null,
    },
  });

  const updated = await db.announcement.findUniqueOrThrow({
    where: { id },
    include: announcementInclude,
  });
  const delta = diff(
    { title: existing.title, content: existing.content, targetAudience: existing.targetAudience, classId: existing.classId },
    { title: body.title, content: body.content, targetAudience: audience, classId }
  );
  if (delta.changed.length > 0) {
    await recordAudit(req, actorOf(actor), {
      action: "UPDATE", entity: "Announcement", entityId: id,
      summary: `Edited announcement "${updated.title}" — ${delta.changed.join(", ")}`,
      before: delta.before, after: delta.after,
    });
  }

  return NextResponse.json({ announcement: toAnnouncementDTO(updated) });
});

// DELETE /api/announcements/[id] — ADMIN
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);

  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Announcement not found");

  await db.announcement.delete({ where: { id } });
  await recordAudit(req, actorOf(actor), {
    action: "DELETE", entity: "Announcement", entityId: id,
    summary: `Deleted announcement "${existing.title}"`,
    before: { title: existing.title, targetAudience: existing.targetAudience },
  });

  return NextResponse.json({ success: true });
});
