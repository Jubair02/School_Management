import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ApiError,
  feeInclude,
  feeStatusFor,
  handle,
  outstandingOf,
  parseBody,
  toFeeDTO,
  toMoney,
} from "@/lib/api-utils";
import { round2 } from "@/lib/grade";

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

  // Without this the surplus is silently swallowed: the status flips to PAID
  // and `outstandingOf` clamps the balance to 0, so there is no record that the
  // school owes anything back. Reject instead of inventing a credit system.
  const feeAmount = toMoney(fee.amount);
  const alreadyPaid = toMoney(fee.paidAmount);
  const outstanding = outstandingOf(feeAmount, alreadyPaid);
  if (outstanding <= 0) {
    throw new ApiError(400, "This fee is already fully paid.");
  }
  if (body.amount > outstanding + 0.005) {
    throw new ApiError(
      400,
      `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`
    );
  }

  const newPaid = round2(alreadyPaid + body.amount);
  const newStatus = feeStatusFor(feeAmount, newPaid, fee.dueDate);

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
