"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, School } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { TimetableEntryDTO, WeekDay } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStudentDashboard, useStudentDetail } from "./use-student";

const BASE_DAYS: WeekDay[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"];

function dayLabel(d: WeekDay): string {
  return d.charAt(0) + d.slice(1, 3).toLowerCase();
}

function todayWeekday(): WeekDay {
  return new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase() as WeekDay;
}

export function StudentTimetableView() {
  const dashboard = useStudentDashboard();
  const detail = useStudentDetail(dashboard.data?.student.id);
  const classId = detail.data?.student.class?.id ?? "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timetable", classId],
    queryFn: () => api.get<{ entries: TimetableEntryDTO[] }>(`/api/timetable${toQuery({ classId })}`),
    enabled: Boolean(classId),
  });

  const loading =
    dashboard.isLoading ||
    (Boolean(dashboard.data) && detail.isFetching && !detail.data) ||
    (Boolean(classId) && isLoading);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Timetable" subtitle="Your weekly class routine" />
        <LoadingState rows={6} />
      </div>
    );
  }

  if (dashboard.error) {
    return <LoadError message={(dashboard.error as Error).message} onRetry={() => void dashboard.refetch()} />;
  }
  if (detail.error) {
    return <LoadError message={(detail.error as Error).message} onRetry={() => void detail.refetch()} />;
  }

  const entries = data?.entries ?? [];
  const student = dashboard.data?.student;
  const today = todayWeekday();
  // The API already returns today's schedule (server-side "today") — use as-is.
  const todayEntries = dashboard.data?.todaySchedule ?? [];

  const days: WeekDay[] = [
    ...BASE_DAYS,
    ...Array.from(new Set(entries.map((e) => e.day))).filter((d) => !BASE_DAYS.includes(d)),
  ];
  const periods = entries.length
    ? Array.from({ length: Math.max(...entries.map((e) => e.period)) }, (_, i) => i + 1)
    : [];
  const cellOf = (day: WeekDay, period: number) =>
    entries.find((e) => e.day === day && e.period === period);

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Timetable"
        subtitle={
          student
            ? `Weekly class routine — ${student.className}${student.sectionName ? `, Section ${student.sectionName}` : ""}`
            : "Your weekly class routine"
        }
      />

      {!detail.data?.student.class ? (
        <EmptyState
          icon={School}
          title="No class assigned yet"
          description="You are not enrolled in a class, so there is no timetable to show. Please contact the school office."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No timetable published yet"
          description="Once the admin publishes your class routine, it will appear here."
        />
      ) : (
        <>
          {/* Today at a glance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today — {dayLabel(today)}</CardTitle>
            </CardHeader>
            <CardContent>
              {todayEntries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No classes scheduled for today.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {todayEntries.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        P{e.period}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.subject?.name ?? "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.teacher?.name ?? "Unassigned"}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {e.startTime}–{e.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Week grid */}
          <div className="scrollbar-thin overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-16 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Period</th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className={cn(
                        "px-3 py-2.5 text-left text-xs font-semibold",
                        d === today
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "text-muted-foreground"
                      )}
                    >
                      {dayLabel(d)}
                      {d === today ? " · Today" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">P{p}</td>
                    {days.map((d) => {
                      const e = cellOf(d, p);
                      return (
                        <td
                          key={d}
                          className={cn(
                            "border-l px-3 py-2.5 align-top",
                            d === today && "bg-emerald-50/60 dark:bg-emerald-500/5"
                          )}
                        >
                          {e ? (
                            <div>
                              <p className="text-sm font-medium">{e.subject?.name ?? "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">{e.teacher?.name ?? "Unassigned"}</p>
                              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                                {e.startTime}–{e.endTime}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
