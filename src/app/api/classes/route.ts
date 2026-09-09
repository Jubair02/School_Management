import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import { ApiError, classInclude, handle, naturalCompare, parseBody, toClassDTO } from "@/lib/api-utils";

// GET /api/classes — any logged-in user
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req);

  const rows = await db.class.findMany({ include: classInclude });
  const classes = rows
    .map(toClassDTO)
    .sort((a, b) => naturalCompare(a.name, b.name));

  return NextResponse.json({ classes });
});

const createSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  academicYear: z.string().min(1, "Academic year is required"),
});

// POST /api/classes — ADMIN
export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const duplicate = await db.class.findFirst({
    where: { name: body.name, academicYear: body.academicYear },
  });
  if (duplicate) {
    throw new ApiError(400, "A class with this name already exists for this academic year");
  }

  const created = await db.class.create({ data: { name: body.name, academicYear: body.academicYear } });
  const full = await db.class.findUniqueOrThrow({ where: { id: created.id }, include: classInclude });
  await recordAudit(req, actorOf(actor), {
    action: "CREATE", entity: "Class", entityId: created.id,
    summary: `Created class ${body.name} (${body.academicYear})`,
    after: { name: body.name, academicYear: body.academicYear },
  });

  return NextResponse.json({ class: toClassDTO(full) }, { status: 201 });
});
