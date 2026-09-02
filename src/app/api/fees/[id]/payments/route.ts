import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { ApiError, feeInclude, feeStatusFor, handle, parseBody, toFeeDTO } from "@/lib/api-utils";

type Ctx = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  method: z.enum(["CASH", "BKASH", "NAGAD", "BANK"]).optional(),
  note: z.string().optional(),
});

// POST /api/fees/[id]/payments — ADMIN — record payment, update paidAmount + status
export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const auth = await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, paymentSchema);

  const fee = await db.fee.findUnique({ where: { id } });
  if (!fee) throw new ApiError(404, "Fee not found");

  const newPaid = fee.paidAmount + body.amount;
  const newStatus = feeStatusFor(fee.amount, newPaid, fee.dueDate);

  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        feeId: fee.id,
        amount: body.amount,
        method: body.method ?? "CASH",
        note: body.note ?? null,
        paidAt: new Date(),
        receivedById: auth.id,
      },
    });
    await tx.fee.update({
      where: { id: fee.id },
      data: { paidAmount: newPaid, status: newStatus },
    });
  });

  const updated = await db.fee.findUniqueOrThrow({ where: { id: fee.id }, include: feeInclude });
  return NextResponse.json({ fee: toFeeDTO(updated) }, { status: 201 });
});
