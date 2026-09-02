"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { Award, UserRound } from "lucide-react";
import {
  EmptyState,
  InitialAvatar,
  LoadingState,
  LoadError,
  PageHeader,
  formatCurrency,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GradeBadge } from "@/components/student/result-sheet";
import { useParentDashboard } from "./use-parent";
import { parentSelection } from "./selection";

export function ParentChildrenView() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  const { data, isLoading, error, refetch } = useParentDashboard();

  const children = useMemo(() => data?.children ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Children" subtitle="Profiles, attendance and fees for each child" />
        <LoadingState variant="cards" rows={2} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      <PageHeader title="My Children" subtitle="Profiles, attendance and fees for each child" />

      {children.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No children linked to your account"
          description="Ask the school office to link your children to this parent account."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => {
            const s = child.student;
            return (
              <Card key={s.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  {/* Identity */}
                  <div className="flex min-w-0 items-center gap-3">
                    <InitialAvatar name={s.name} className="size-11 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold tracking-tight">{s.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{s.studentId}</p>
                    </div>
                  </div>

                  {/* Class + roll */}
                  <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Class</p>
                      <p className="font-medium">
                        {s.className}
                        {s.sectionName ? ` — Section ${s.sectionName}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Roll</p>
                      <p className="font-medium tabular-nums">{s.rollNumber}</p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Attendance</p>
                      <p className="text-lg font-bold tabular-nums">{Math.round(child.attendancePct)}%</p>
                      <Progress value={child.attendancePct} className="mt-1 h-1.5" aria-label="Attendance percentage" />
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

                  {/* Actions */}
                  <div className="mt-auto flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        parentSelection.resultsChildId = s.id;
                        setActiveView("parent:results");
                      }}
                    >
                      <Award className="size-4" aria-hidden />
                      View results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
