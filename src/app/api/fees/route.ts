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
  outstandingOf,
  getParentByUserId,
  getStudentByUserId,
  parseBody,
  q,
  requireDay,
  toFeeDTO,
  toMoney,
} from "@/lib/api-utils";

// GET /api/fees?studentId&status&type
// ADMIN any filters; STUDENT self only; PARENT own children only. TEACHER → 403.
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);

  const statusFilter = q(req, "status");
  const typeFilter = q(req, "type");
  let studentFilter: string | { in: string[] } | undefined = q(req, "studentId");

  if (auth.role === "STUDENT") {
    const self = await getStudentByUserId(auth.id);
    if (!self) throw new ApiError(404, "Student profile not found");
    if (typeof studentFilter === "string" && studentFilter !== self.id) {
      throw new ApiError(403, "You can only view your own fees");
    }
    studentFilter = self.id;
  } else if (auth.role === "PARENT") {
    const parent = await getParentByUserId(auth.id);
    if (!parent) throw new ApiError(404, "Parent profile not found");
    const children = await db.student.findMany({
      where: { parentId: parent.id },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (typeof studentFilter === "string") {
      if (!childIds.includes(studentFilter)) {
        throw new ApiError(403, "You can only view your own children's fees");
      }
    } else {
      studentFilter = { in: childIds };
    }
  } else if (auth.role !== "ADMIN") {
    throw new ApiError(403, "You do not have permission to view fees");
  }

  // `status` is deliberately NOT part of the SQL filter: the stored column can
  // be stale (a PENDING fee whose due date has passed is really OVERDUE), so
  // filtering on it in the database would drop rows that should match. It is
  // applied below against the freshly computed value instead.
  const where = {
    ...(studentFilter !== undefined ? { studentId: studentFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
  };

  const rows = await db.fee.findMany({ where, include: feeInclude, orderBy: { dueDate: "desc" } });

  // Status is derived, not stored state: PENDING becomes OVERDUE purely by the
  // due date passing. This used to persist the recomputation, so every read
  // issued a burst of UPDATEs — a write on a GET, and needless load on a
  // serverless connection pool. The stored `status` column is now just a cache;
  // the value below is always computed fresh, so reads stay read-only.
  const allFees = rows.map((f) =>
    toFeeDTO(f, feeStatusFor(toMoney(f.amount), toMoney(f.paidAmount), f.dueDate))
  );
  const fees = statusFilter ? allFees.filter((f) => f.status === statusFilter) : allFees;

  const summary = {
    totalDue: Math.round(fees.reduce((s, f) => s + outstandingOf(f.amount, f.paidAmount), 0) * 100) / 100,
    totalCollected: Math.round(fees.reduce((s, f) => s + f.paidAmount, 0) * 100) / 100,
    pendingCount: fees.filter((f) => f.status === "PENDING" || f.status === "PARTIAL").length,
    overdueCount: fees.filter((f) => f.status === "OVERDUE").length,
  };

  return NextResponse.json({ fees, total: fees.length, summary });
});

const createSchema = z.object({
  studentId: z.string().min(1, "studentId is required"),
  title: z.string().min(1, "Title is required"),
  type: z.enum(FEE_TYPES),
  amount: z.number().positive("Amount must be greater than 0"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

// POST /api/fees — ADMIN
export const POST = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);
  const body = await parseBody(req, createSchema);

  const student = await db.student.findUnique({ where: { id: body.studentId } });
  if (!student) throw new ApiError(404, "Student not found");

  requireDay(body.dueDate, "dueDate");
  const dueDate = new Date(`${body.dueDate}T00:00:00.000Z`);

  const created = await db.fee.create({
    data: {
      studentId: student.id,
      title: body.title,
      type: body.type,
      amount: body.amount,
      paidAmount: 0,
      dueDate,
      status: feeStatusFor(body.amount, 0, dueDate),
    },
  });

  const fee = await db.fee.findUniqueOrThrow({ where: { id: created.id }, include: feeInclude });
  return NextResponse.json({ fee: toFeeDTO(fee) }, { status: 201 });
});
