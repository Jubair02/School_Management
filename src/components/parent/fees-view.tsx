"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { EmptyState, LoadingState, LoadError, PageHeader } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeesContent } from "@/components/student/fees-content";
import { useParentDashboard } from "./use-parent";

export function ParentFeesView() {
  const [childId, setChildId] = useState("");

  const { data, isLoading, error, refetch } = useParentDashboard();
  const children = useMemo(() => data?.children ?? [], [data]);

  const activeChildId =
    childId && children.some((c) => c.student.id === childId) ? childId : (children[0]?.student.id ?? "");
  const activeChild = children.find((c) => c.student.id === activeChildId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fees"
        subtitle="Invoices and payment history for your children"
        actions={
          children.length > 0 ? (
            <Select value={activeChildId} onValueChange={setChildId}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Select child">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.student.id} value={c.student.id}>
                    {c.student.name} · {c.student.className}
                    {c.student.sectionName ? `-${c.student.sectionName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState variant="cards" rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : children.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No children linked to your account"
          description="Ask the school office to link your children to this parent account."
        />
      ) : (
        <FeesContent
          key={activeChildId}
          studentId={activeChildId}
          hint={`Payments for ${activeChild?.student.name ?? "your child"} are recorded by the school office. To pay an invoice or resolve a discrepancy, please contact the front desk.`}
          emptyTitle="No fees for this child"
          emptyDescription={`No invoices have been issued for ${activeChild?.student.name ?? "this child"} yet.`}
        />
      )}
    </div>
  );
}
