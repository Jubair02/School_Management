"use client";

import { Megaphone } from "lucide-react";
import {
  EmptyState,
  InitialAvatar,
  LoadingState,
  LoadError,
  PageHeader,
  formatCurrency,
  formatDate,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { GradeBadge } from "@/components/student/result-sheet";
import { useParentDashboard } from "./use-parent";

export function ParentDashboardView() {
  const { data, isLoading, error, refetch } = useParentDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={2} />
        <LoadingState variant="list" rows={3} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { children, announcements } = data;

  return (
    <div className="space-y-6">
      <PageHeader title="Family Overview" subtitle="Attendance, results and fees for your children" />

      {children.length === 0 ? (
        <EmptyState
          title="No children linked to your account"
          description="Ask the school office to link your children to this parent account."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => {
            const s = child.student;
            const classLabel = `${s.className}${s.sectionName ? ` — Section ${s.sectionName}` : ""}`;
            return (
              <Card key={s.id}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <InitialAvatar name={s.name} className="size-11 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold tracking-tight">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {classLabel} · Roll {s.rollNumber}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                      <p className="text-lg font-bold tabular-nums">{Math.round(child.attendancePct)}%</p>
                      <ProgressBar value={child.attendancePct} className="mt-1 h-1.5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GPA</p>
                      <p className="text-lg font-bold tabular-nums">
                        {child.gpa == null ? "—" : child.gpa.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Recent grade</p>
                      {child.recentGrade ? (
                        <GradeBadge grade={child.recentGrade} className="mt-1" />
                      ) : (
                        <Badge variant="outline" className="mt-1 text-muted-foreground">
                          None yet
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pending fees</p>
                      {child.pendingFeeAmount > 0 ? (
                        <p className="mt-1 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {formatCurrency(child.pendingFeeAmount)}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          All clear
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-muted-foreground" aria-hidden />
            Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <EmptyState title="No announcements right now" description="School notices will show up here." />
          ) : (
            <ul className="space-y-2">
              {announcements.slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
