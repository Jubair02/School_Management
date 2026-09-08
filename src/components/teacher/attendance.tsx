"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarOff,
  CheckCheck,
  CheckCircle2,
  Clock,
  Eraser,
  Info,
  Loader2,
  Save,
  Users,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { AttendanceRosterResponse, AttendanceStatus } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader, ScrollTable } from "@/components/shared";
import { useAppStore } from "@/store/app-store";
import { formatDay, todayISO, type MyClassesResponse } from "./common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_META: { value: AttendanceStatus; label: string; icon: LucideIcon; className: string }[] = [
  { value: "PRESENT", label: "Present", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  { value: "ABSENT", label: "Absent", icon: XCircle, className: "text-rose-600 dark:text-rose-400" },
  { value: "LATE", label: "Late", icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  { value: "LEAVE", label: "On leave", icon: CalendarOff, className: "text-orange-600 dark:text-orange-400" },
];

type Counts = Record<AttendanceStatus, number> & { unmarked: number };

function CountChip({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium tabular-nums", className)}>
      {count} {label}
    </span>
  );
}

export function TeacherAttendanceView() {
  const queryClient = useQueryClient();

  // Initial state seeded from a "Take attendance" quick action (app-store preselect)
  const [classId, setClassId] = useState(() => useAppStore.getState().takePreselect("attendancePreselect") ?? "");
  const [date, setDate] = useState(todayISO);
  /**
   * Unsaved status edits as an overlay on top of the server roster, keyed by
   * "classId|date". An overlay (instead of a full draft copy) needs no effects:
   * when the roster changes the key stops matching and edits fall away, while
   * `undefined` in the overlay means "no edit → show the server status".
   */
  const [edits, setEdits] = useState<{ key: string; values: Record<string, AttendanceStatus | null> }>({
    key: "",
    values: {},
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["teacher", "my-classes"],
    queryFn: () => api.get<MyClassesResponse>("/api/teachers/me/classes"),
  });
  const classes = classesData?.classes ?? [];
  const effectiveClassId = classes.some((c) => c.id === classId) ? classId : (classes[0]?.id ?? "");
  const selectedClass = classes.find((c) => c.id === effectiveClassId);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["teacher", "attendance", { classId: effectiveClassId, date }],
    queryFn: () =>
      api.get<AttendanceRosterResponse>(`/api/attendance${toQuery({ classId: effectiveClassId, date })}`),
    enabled: Boolean(effectiveClassId),
    staleTime: 60_000, // avoid background refetches clobbering in-progress edits
  });

  // Effective status = user edit (if any) overlaid on the server roster value.
  const records = data?.records ?? [];
  const draftKey = `${effectiveClassId}|${date}`;
  const editValues = edits.key === draftKey ? edits.values : {};

  /** Effective status shown in the row: user edit wins, otherwise server value. */
  function statusOf(studentId: string, serverStatus: AttendanceStatus | null): AttendanceStatus | null {
    const v = editValues[studentId];
    return v === undefined ? serverStatus : v;
  }

  // Plain derivation — the React Compiler memoizes; rosters are small anyway.
  const counts: Counts = (() => {
    const c: Counts = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, unmarked: 0 };
    for (const r of records) {
      const v = editValues[r.studentId];
      const st = v === undefined ? r.status : v;
      if (st) c[st] += 1;
      else c.unmarked += 1;
    }
    return c;
  })();

  const markedCount = counts.PRESENT + counts.ABSENT + counts.LATE + counts.LEAVE;

  /**
   * Save is enabled when there is anything to write: either marks to record, or
   * pending edits. Edits matter on their own — clearing every student leaves
   * markedCount at 0 yet still needs saving to delete the stored records.
   */
  const hasChanges = markedCount > 0 || Object.keys(editValues).length > 0;

  function setStatus(studentId: string, status: AttendanceStatus | null) {
    setEdits({ key: draftKey, values: { ...editValues, [studentId]: status } });
  }

  function markAll(status: AttendanceStatus | null) {
    const values: Record<string, AttendanceStatus | null> = {};
    for (const r of records) values[r.studentId] = status;
    setEdits({ key: draftKey, values });
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      // The roster as shown is the source of truth for this day: nulls are sent
      // through so the server can clear records the teacher un-marked. Filtering
      // them out (as before) made the Clear button a no-op.
      const payload = records.map((r) => ({
        studentId: r.studentId,
        status: statusOf(r.studentId, r.status),
      }));
      return api.post<{ saved: number; cleared: number }>("/api/attendance", {
        classId: effectiveClassId,
        date,
        records: payload,
      });
    },
    onSuccess: (res) => {
      const parts = [`${res.saved} marked`];
      if (res.cleared > 0) parts.push(`${res.cleared} cleared`);
      toast.success(`Attendance saved — ${parts.join(", ")}`);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filters = (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-2 lg:max-w-56">
          <Label>Class</Label>
          <Select value={effectiveClassId} onValueChange={setClassId} disabled={classes.length === 0}>
            <SelectTrigger className="w-full" aria-label="Choose class">
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
        </div>
        <div className="grid flex-1 gap-2 lg:max-w-44">
          <Label htmlFor="att-date">Date</Label>
          <Input
            id="att-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Attendance date"
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDate(todayISO())}>
          <CalendarDays className="size-4" aria-hidden />
          Today
        </Button>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => markAll("PRESENT")}
            disabled={records.length === 0}
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all present
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => markAll(null)} disabled={records.length === 0}>
            <Eraser className="size-4" aria-hidden />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance"
        subtitle="Mark the daily roster — saving is partial-safe, unmarked students stay unmarked"
      />

      {classesLoading ? (
        <LoadingState rows={4} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes assigned yet"
          description="Attendance opens up once the office assigns you to a class."
        />
      ) : (
        <>
          {filters}

          {/* Existing-attendance banner */}
          {data && data.markedCount > 0 ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong>Editing existing attendance</strong> — {data.markedCount} of {records.length} students were
                already marked for {formatDay(data.date)}. Saving updates those records in place.
              </span>
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState rows={6} />
          ) : error ? (
            <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No active students in this class"
              description={
                selectedClass
                  ? `Attendance for ${selectedClass.name} will be available once students are enrolled.`
                  : "Choose a class to take attendance."
              }
            />
          ) : (
            <ScrollTable maxHeight="max-h-[520px]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-44 text-right sm:w-52">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => {
                    const current = statusOf(r.studentId, r.status);
                    return (
                      <TableRow key={r.studentId} className={cn(!current && "bg-muted/20")}>
                        <TableCell className="font-medium tabular-nums">{r.rollNumber}</TableCell>
                        <TableCell className="font-medium">{r.studentName}</TableCell>
                        <TableCell>
                          <Select
                            value={current ?? ""}
                            onValueChange={(v) => setStatus(r.studentId, v as AttendanceStatus)}
                          >
                            <SelectTrigger
                              className={cn("ml-auto w-40 sm:w-44", !current && "text-muted-foreground")}
                              aria-label={`Attendance status for ${r.studentName}`}
                            >
                              <SelectValue placeholder="Not marked" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_META.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className="flex items-center gap-2">
                                    <s.icon className={cn("size-4", s.className)} aria-hidden />
                                    {s.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollTable>
          )}

          {/* Sticky save bar */}
          {records.length > 0 ? (
            <div className="sticky bottom-4 z-10">
              <Card className="border-emerald-200/70 bg-card/95 shadow-lg backdrop-blur dark:border-emerald-500/25">
                <CardContent className="flex flex-wrap items-center gap-2 p-3">
                  <CountChip
                    label="present"
                    count={counts.PRESENT}
                    className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                  />
                  <CountChip
                    label="absent"
                    count={counts.ABSENT}
                    className="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                  />
                  <CountChip
                    label="late"
                    count={counts.LATE}
                    className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                  />
                  <CountChip
                    label="leave"
                    count={counts.LEAVE}
                    className="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400"
                  />
                  <CountChip label="unmarked" count={counts.unmarked} className="bg-muted text-muted-foreground" />
                  <Button
                    className="ml-auto"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !hasChanges}
                    title={hasChanges ? undefined : "Mark a student, or change one, to save"}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    Save attendance
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
