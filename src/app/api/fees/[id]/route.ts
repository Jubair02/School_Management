import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ApiError,
  FEE_TYPES,
  feeInclude,
  feeStatusFor,
  handle,
  parseBody,
  requireDay,
  toFeeDTO,
  toMoney,
} from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  type: z.enum(FEE_TYPES).optional(),
  amount: z.number().positive("Amount must be greater than 0").optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
});

// PUT /api/fees/[id] — ADMIN. Without this, correcting a mistyped amount meant
// deleting the invoice, which cascades away its whole payment history.
export const PUT = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, updateSchema);

  const existing = await db.fee.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Fee not found");

  const existingPaid = toMoney(existing.paidAmount);
  const amount = body.amount ?? toMoney(existing.amount);
  // Payments are already recorded against this invoice; the total cannot drop
  // below what has been collected or the balance goes negative.
  if (amount < existingPaid) {
    throw new ApiError(
      400,
      `Amount cannot be less than the ${existingPaid.toFixed(2)} already paid.`
    );
  }

  const dueDate = body.dueDate
    ? new Date(`${requireDay(body.dueDate, "dueDate")}T00:00:00.000Z`)
    : existing.dueDate;

  await db.fee.update({
    where: { id },
    data: {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      amount,
      dueDate,
      status: feeStatusFor(amount, existingPaid, dueDate),
    },
  });

  const updated = await db.fee.findUniqueOrThrow({ where: { id }, include: feeInclude });
  return NextResponse.json({ fee: toFeeDTO(updated) });
});

// DELETE /api/fees/[id] — ADMIN (payments cascade)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  await requireAuth(req, ["ADMIN"]);

  const existing = await db.fee.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Fee not found");

  await db.fee.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
