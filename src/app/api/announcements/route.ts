import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, recordAudit } from "@/lib/audit";
import {
  ApiError,
  AUDIENCES,
  announcementInclude,
  announcementWhereFor,
  getStudentByUserId,
  getTeacherClassIds,
  handle,
  parseBody,
  toAnnouncementDTO,
} from "@/lib/api-utils";

// GET /api/announcements — any logged-in user, role-filtered, newest first
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);

  let where: Prisma.AnnouncementWhereInput;
  if (auth.role === "TEACHER") {
    const teacher = await db.teacher.findUnique({ where: { userId: auth.id } });
    const classIds = teacher ? await getTeacherClassIds(teacher.id) : [];
    where = announcementWhereFor("TEACHER", { teacherClassIds: classIds });
  } else if (auth.role === "STUDENT") {
    const student = await getStudentByUserId(auth.id);
    where = announcementWhereFor("STUDENT", { studentClassId: student?.classId ?? null });
  } else if (auth.role === "PARENT") {
    const parent = await db.parent.findUnique({ where: { userId: auth.id } });
    const children = parent
      ? await db.student.findMany({ where: { parentId: parent.id }, select: { classId: true } })
      : [];
    where = announcementWhereFor("PARENT", {
      childrenClassIds: children.map((c) => c.classId).filter((id): id is string => Boolean(id)),
    });
  } else {
    where = announcementWhereFor("ADMIN", {});
  }

  const rows = await db.announcement.findMany({
    where,
    include: announcementInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ announcements: rows.map(toAnnouncementDTO) });
});

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  targetAudience: z.enum(AUDIENCES),
  classId: z.string().optional(),
});

// POST /api/announcements — ADMIN
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  if (body.targetAudience === "SPECIFIC_CLASS" && !body.classId) {
    throw new ApiError(400, "classId is required when target audience is SPECIFIC_CLASS");
  }
  if (body.classId) {
    const cls = await db.class.findUnique({ where: { id: body.classId } });
    if (!cls) throw new ApiError(404, "Class not found");
  }

  const created = await db.announcement.create({
    data: {
      title: body.title,
      content: body.content,
      targetAudience: body.targetAudience,
      classId: body.classId ?? null,
      publishedById: auth.id,
    },
  });

  const announcement = await db.announcement.findUniqueOrThrow({
    where: { id: created.id },
    include: announcementInclude,
  });
  await recordAudit(req, actorOf(auth), {
    action: "CREATE", entity: "Announcement", entityId: created.id,
    summary: `Published "${body.title}" to ${body.targetAudience}`,
    after: { title: body.title, targetAudience: body.targetAudience, classId: body.classId ?? null },
  });

  return NextResponse.json({ announcement: toAnnouncementDTO(announcement) }, { status: 201 });
});
