"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { titleCase } from "./format";

/**
 * Maps domain status values to soft colored badges.
 * Blue/indigo intentionally avoided — emerald is the brand primary.
 */
const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  INACTIVE: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  PRESENT: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ABSENT: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  LATE: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  LEAVE: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  PENDING: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  PARTIAL: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  PAID: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  OVERDUE: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  SCHEDULED: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  ONGOING: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  COMPLETED: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant="outline" className={cn(style ?? "text-muted-foreground", className)}>
      {titleCase(status)}
    </Badge>
  );
}
