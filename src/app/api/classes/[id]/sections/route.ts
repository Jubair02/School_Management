import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
import { ApiError, handle, parseBody } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  name: z.string().min(1, "Section name is required"),
});

// POST /api/classes/[id]/sections — ADMIN
export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const cls = await db.class.findUnique({ where: { id } });
  if (!cls) throw new ApiError(404, "Class not found");

  const duplicate = await db.section.findFirst({ where: { classId: id, name: body.name } });
  if (duplicate) throw new ApiError(400, "A section with this name already exists in this class");

  const section = await db.section.create({ data: { name: body.name, classId: id } });
  await recordAudit(req, actorOf(actor), {
    action: "CREATE", entity: "Section", entityId: section.id,
    summary: `Added section ${section.name} to ${cls.name}`,
    after: { name: section.name, class: cls.name },
  });

  return NextResponse.json({ section }, { status: 201 });
});
