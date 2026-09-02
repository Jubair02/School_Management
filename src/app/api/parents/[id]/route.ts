import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, handle, parentInclude, parseBody, toParentDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

async function loadParent(id: string) {
  const parent = await db.parent.findUnique({ where: { id }, include: parentInclude });
  if (!parent) throw new ApiError(404, "Parent not found");
  return parent;
}

// GET /api/parents/[id] — ADMIN
export const GET = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const parent = await loadParent(id);
  return NextResponse.json({ parent: toParentDTO(parent) });
});

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.email("A valid email is required").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// PUT /api/parents/[id] — ADMIN
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const parent = await loadParent(id);

  const userData: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) userData.name = body.name;
  if (body.email !== undefined) userData.email = body.email.trim().toLowerCase();
  if (body.password !== undefined) userData.password = await bcrypt.hash(body.password, 10);
  if (body.phone !== undefined) userData.phone = body.phone;

  const parentData: Prisma.ParentUpdateInput = {};
  if (body.phone !== undefined) parentData.phone = body.phone;
  if (body.address !== undefined) parentData.address = body.address;

  await db.$transaction(async (tx) => {
    if (Object.keys(parentData).length > 0) {
      await tx.parent.update({ where: { id: parent.id }, data: parentData });
    }
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: parent.userId }, data: userData });
    }
  });

  const updated = await db.parent.findUnique({ where: { id: parent.id }, include: parentInclude });
  return NextResponse.json({ parent: updated ? toParentDTO(updated) : null });
});

// DELETE /api/parents/[id] — ADMIN — soft delete (user.status = INACTIVE)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const parent = await loadParent(id);
  await db.user.update({ where: { id: parent.userId }, data: { status: "INACTIVE" } });

  return NextResponse.json({ success: true });
});
