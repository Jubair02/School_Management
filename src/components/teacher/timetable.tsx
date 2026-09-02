"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import type { TimetableEntryDTO, WeekDay } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { formatTime, type MyClass } from "./common";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS: { value: WeekDay; label: string }[] = [
  { value: "SUNDAY", label: "Sun" },
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
];

export function TeacherTimetableView() {
  const { user } = useAuth();
  const [classId, setClassId] = useState("");

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["teacher", "my-classes"],
    queryFn: () => api.get<{ classes: MyClass[] }>("/api/teachers/me/classes"),
  });
  const classes = classesData?.classes ?? [];
  const effectiveClassId = classes.some((c) => c.id === classId) ? classId : (classes[0]?.id ?? "");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timetable", { classId: effectiveClassId }],
    queryFn: () => api.get<{ entries: TimetableEntryDTO[] }>(`/api/timetable?classId=${effectiveClassId}`),
    enabled: Boolean(effectiveClassId),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableEntryDTO>();
    for (const e of entries) map.set(`${e.day}-${e.period}`, e);
    return map;
  }, [entries]);

  const periods = useMemo(() => {
    const set = new Set(entries.map((e) => e.period));
    if (set.size === 0) return Array.from({ length: 8 }, (_, i) => i + 1);
    return Array.from(set).sort((a, b) => a - b);
  }, [entries]);

  const periodTimes = useMemo(() => {
    const map = new Map<number, { start: string; end: string }>();
    for (const e of entries) {
      if (!map.has(e.period)) map.set(e.period, { start: e.startTime, end: e.endTime });
    }
    return map;
  }, [entries]);

  const myPeriodCount = entries.filter((e) => e.teacher?.id === user?.id).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Timetable"
        subtitle="Weekly schedule per class — your own periods are highlighted"
        actions={
          <Select value={effectiveClassId} onValueChange={setClassId} disabled={classes.length === 0}>
            <SelectTrigger className="w-full min-w-40 sm:w-48" aria-label="Choose class">
              <SelectValue placeholder="Choose class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {classesLoading ? (
        <LoadingState rows={6} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes assigned yet"
          description="Your timetable appears once the office assigns you to a class."
        />
      ) : isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No timetable yet"
          description="The office hasn't built the weekly schedule for this class."
        />
      ) : (
        <>
          <div className="scrollbar-thin overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <caption className="sr-only">Weekly timetable, Sunday to Thursday</caption>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th
                    scope="col"
                    className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Period
                  </th>
                  {DAYS.map((d) => (
                    <th
                      key={d.value}
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const times = periodTimes.get(p);
                  return (
                    <tr key={p} className="border-b last:border-b-0">
                      <td className="px-3 py-2 align-top">
                        <p className="font-medium">P{p}</p>
                        {times ? (
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {formatTime(times.start)}–{formatTime(times.end)}
                          </p>
                        ) : null}
                      </td>
                      {DAYS.map((d) => {
                        const entry = cellMap.get(`${d.value}-${p}`);
                        const mine = entry?.teacher?.id === user?.id;
                        return (
                          <td key={d.value} className="px-2 py-2 align-top">
                            {entry ? (
                              <div
                                className={cn(
                                  "relative rounded-md border p-2",
                                  mine
                                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                                    : "border-border bg-muted/40"
                                )}
                              >
                                <p
                                  className={cn(
                                    "truncate pr-7 text-xs font-semibold",
                                    mine ? "text-emerald-800 dark:text-emerald-300" : "text-foreground/80"
                                  )}
                                >
                                  {entry.subject?.name ?? "—"}
                                </p>
                                <p
                                  className={cn(
                                    "truncate text-[10px]",
                                    mine
                                      ? "text-emerald-700/70 dark:text-emerald-400/70"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {entry.teacher?.name ?? "No teacher"}
                                </p>
                                {mine ? (
                                  <Badge className="absolute right-1 top-1 border-transparent bg-emerald-600 px-1.5 py-0 text-[9px] text-white dark:bg-emerald-500">
                                    me
                                  </Badge>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex h-[52px] items-center justify-center rounded-md text-muted-foreground/30">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span
              className="inline-block size-3 rounded-sm border border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/20"
              aria-hidden
            />
            Your periods ({myPeriodCount} in this class) ·
            <span
              className="inline-block size-3 rounded-sm border bg-muted/60"
              aria-hidden
            />
            Other teachers · read-only view
          </p>
        </>
      )}
    </div>
  );
}
