import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { actorOf, diff, recordAudit } from "@/lib/audit";
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
  const auth = await requireAuth(req, ["ADMIN"]);
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

  const delta = diff(
    { title: existing.title, type: existing.type, amount: toMoney(existing.amount), dueDate: existing.dueDate },
    { title: body.title, type: body.type, amount: body.amount, dueDate }
  );
  if (delta.changed.length > 0) {
    await recordAudit(req, actorOf(auth), {
      action: "UPDATE",
      entity: "Fee",
      entityId: id,
      summary: `Edited invoice "${updated.title}" for ${updated.student.user.name} (${delta.changed.join(", ")})`,
      before: delta.before,
      after: delta.after,
    });
  }

  return NextResponse.json({ fee: toFeeDTO(updated) });
});

// DELETE /api/fees/[id] — ADMIN (payments cascade)
export const DELETE = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const auth = await requireAuth(req, ["ADMIN"]);

  const existing = await db.fee.findUnique({
    where: { id },
    include: { student: { include: { user: { select: { name: true } } } }, _count: { select: { payments: true } } },
  });
  if (!existing) throw new ApiError(404, "Fee not found");

  await db.fee.delete({ where: { id } });

  await recordAudit(req, actorOf(auth), {
    action: "DELETE",
    entity: "Fee",
    entityId: id,
    summary:
      `Deleted invoice "${existing.title}" (${toMoney(existing.amount)}) for ${existing.student.user.name}` +
      `, discarding ${existing._count.payments} payment record(s)`,
    before: {
      title: existing.title,
      type: existing.type,
      amount: toMoney(existing.amount),
      paidAmount: toMoney(existing.paidAmount),
      payments: existing._count.payments,
    },
  });

  return NextResponse.json({ success: true });
});
