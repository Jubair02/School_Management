import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit, safePayload } from "@/lib/audit";
import { handle, parentInclude, parseBody, q, toParentDTO } from "@/lib/api-utils";

// GET /api/parents?query — ADMIN
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);

  const query = q(req, "query");
  const where: Prisma.ParentWhereInput = query
    ? {
        OR: [
          { user: { name: { contains: query, mode: "insensitive" } } },
          { user: { email: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    db.parent.findMany({ where, include: parentInclude, orderBy: { user: { name: "asc" } } }),
    db.parent.count({ where }),
  ]);

  return NextResponse.json({ parents: rows.map(toParentDTO), total });
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("A valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// POST /api/parents — ADMIN — creates User (role PARENT) + Parent
export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const hashed = await bcrypt.hash(body.password ?? "Parent@123", 10);

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: body.name,
        email: body.email.trim().toLowerCase(),
        password: hashed,
        role: "PARENT",
        phone: body.phone ?? null,
      },
    });
    return tx.parent.create({
      data: { userId: user.id, phone: body.phone ?? null, address: body.address ?? null },
    });
  });

  const parent = await db.parent.findUnique({ where: { id: created.id }, include: parentInclude });
  await recordAudit(req, actorOf(actor), {
    action: "CREATE", entity: "Parent", entityId: created.id,
    summary: `Added parent ${body.name}`,
    after: safePayload({ ...body }),
  });

  return NextResponse.json({ parent: parent ? toParentDTO(parent) : null }, { status: 201 });
});
