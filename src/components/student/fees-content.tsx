"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  ChevronDown,
  Clock,
  History,
  Info,
  Wallet,
} from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { FeeDTO, FeeListResponse, FeeType } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  StatCard,
  StatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
  titleCase,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<FeeType, string> = {
  TUITION: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ADMISSION: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  EXAM: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  TRANSPORT: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  LIBRARY: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  OTHER: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
};

const METHOD_STYLES: Record<string, string> = {
  CASH: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  BKASH: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  NAGAD: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  BANK: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
};

/**
 * Read-only fee list + summary shared by student:fees (self) and parent:fees
 * (?studentId=child). Payments are office-recorded — no pay action here.
 */
export function FeesContent({
  studentId,
  hint,
  emptyTitle = "No fees found",
  emptyDescription = "Invoices issued for this student will appear here.",
}: {
  studentId?: string;
  hint?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["fees", { studentId: studentId ?? "self" }],
    queryFn: () => api.get<FeeListResponse>(`/api/fees${toQuery({ studentId })}`),
  });

  const fees = data?.fees ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total due"
          value={formatCurrency(summary?.totalDue ?? 0)}
          sub="Outstanding balance"
          tone="rose"
          loading={isLoading}
        />
        <StatCard
          icon={BadgeDollarSign}
          label="Collected"
          value={formatCurrency(summary?.totalCollected ?? 0)}
          sub="Payments received"
          tone="emerald"
          loading={isLoading}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={summary?.pendingCount ?? 0}
          sub="Unpaid invoices"
          tone="amber"
          loading={isLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={summary?.overdueCount ?? 0}
          sub="Past due date"
          tone="orange"
          loading={isLoading}
        />
      </div>

      {/* Office-recorded payments hint */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {hint ??
            "Fee payments are recorded by the school office. To pay an invoice or resolve a discrepancy, please contact the front desk."}
        </p>
      </div>

      {/* Fee cards */}
      {isLoading ? (
        <LoadingState variant="list" rows={3} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : fees.length === 0 ? (
        <EmptyState icon={Wallet} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {fees.map((fee) => (
            <FeeCard
              key={fee.id}
              fee={fee}
              open={openId === fee.id}
              onToggle={(next) => setOpenId(next ? fee.id : null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeeCard({ fee, open, onToggle }: { fee: FeeDTO; open: boolean; onToggle: (open: boolean) => void }) {
  const remaining = Math.max(0, fee.amount - fee.paidAmount);
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className={TYPE_STYLES[fee.type]}>
              {titleCase(fee.type)}
            </Badge>
            <StatusBadge status={fee.status} />
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums">{formatCurrency(fee.amount)}</p>
            <p className="text-xs text-muted-foreground">Due {formatDate(fee.dueDate)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">{fee.title}</p>
          <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>
              Paid:{" "}
              <span className={cn("font-semibold", fee.paidAmount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>
                {formatCurrency(fee.paidAmount)}
              </span>
            </span>
            <span>
              Remaining:{" "}
              <span className={cn("font-semibold", remaining > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                {formatCurrency(remaining)}
              </span>
            </span>
          </p>
        </div>

        <Collapsible open={open} onOpenChange={onToggle}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              <History className="size-4" aria-hidden />
              Payment history ({fee.payments.length})
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {fee.payments.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <ol className="space-y-2 pt-1">
                {fee.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Banknote className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.amount)}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateTime(p.paidAt)}
                        {p.note ? ` · ${p.note}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("font-mono text-[10px]", METHOD_STYLES[p.method])}>
                      {p.method}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
