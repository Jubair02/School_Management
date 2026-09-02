"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const TONES = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400",
} as const;

export type StatTone = keyof typeof TONES;

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
  loading?: boolean;
  className?: string;
}

export function StatCard({ icon: Icon, label, value, sub, tone = "emerald", loading, className }: StatCardProps) {
  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="flex items-center gap-3 px-4">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          {loading ? (
            <>
              <Skeleton className="h-6 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </>
          ) : (
            <>
              <p className="truncate text-xl font-bold leading-tight tabular-nums">{value}</p>
              <p className="truncate text-xs text-muted-foreground">{sub ?? label}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
