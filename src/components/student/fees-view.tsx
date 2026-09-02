"use client";

import { PageHeader } from "@/components/shared";
import { FeesContent } from "./fees-content";

/**
 * student:fees — the logged-in student's invoices and payment history.
 * GET /api/fees resolves self when studentId is omitted.
 */
export function StudentFeesView() {
  return (
    <div className="space-y-4">
      <PageHeader title="My Fees" subtitle="Invoices, payments and your outstanding balance" />
      <FeesContent />
    </div>
  );
}
