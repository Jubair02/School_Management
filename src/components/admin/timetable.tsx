"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/client-api";
import type {
  ClassDTO,
  SubjectDTO,
  TeacherListResponse,
  TimetableEntryDTO,
  WeekDay,
} from "@/lib/types";
import {
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAYS: { value: WeekDay; label: string; full: string }[] = [
  { value: "SUNDAY", label: "Sun", full: "Sunday" },
  { value: "MONDAY", label: "Mon", full: "Monday" },
  { value: "TUESDAY", label: "Tue", full: "Tuesday" },
  { value: "WEDNESDAY", label: "Wed", full: "Wednesday" },
  { value: "THURSDAY", label: "Thu", full: "Thursday" },
];

const MAX_PERIOD = 8;

function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m ?? "00"} ${suffix}`;
}

// ── Add entry dialog ──────────────────────────────────────────

interface EntryFormValues {
  day: WeekDay;
  period: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId: string;
}

function TimetableEntryDialog({
  onOpenChange,
  classId,
  initialDay,
  initialPeriod,
  defaultStart,
  defaultEnd,
}: {
  onOpenChange: (open: boolean) => void;
  classId: string;
  initialDay: WeekDay;
  initialPeriod: number;
  defaultStart: string;
  defaultEnd: string;
}) {
  const queryClient = useQueryClient();
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects", { classId }],
    queryFn: () => api.get<{ subjects: SubjectDTO[] }>(`/api/subjects?classId=${classId}`),
    enabled: Boolean(classId),
  });
  const { data: teachersData } = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: () => api.get<TeacherListResponse>("/api/teachers"),
  });

  // Mounted only while adding — initializers seed from the clicked slot each time.
  const [values, setValues] = useState<EntryFormValues>({
    day: initialDay,
    period: String(initialPeriod),
    startTime: defaultStart,
    endTime: defaultEnd,
    subjectId: "",
    teacherId: "",
  });

  const mutation = useMutation({
    mutationFn: (v: EntryFormValues) =>
      api.post("/api/timetable", {
        classId,
        day: v.day,
        period: Number(v.period),
        startTime: v.startTime,
        endTime: v.endTime,
        subjectId: v.subjectId,
        teacherId: v.teacherId || undefined,
      }),
    onSuccess: () => {
      toast.success("Timetable entry added");
      void queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSave = values.subjectId && values.startTime && values.endTime;

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Add timetable entry"
      description={`Class period on ${DAYS.find((d) => d.value === values.day)?.label ?? ""} — period ${values.period}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) {
          toast.error("Pick a subject and both times");
          return;
        }
        mutation.mutate(values);
      }}
      submitting={mutation.isPending}
      submitLabel="Add entry"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Day</Label>
          <Select value={values.day} onValueChange={(day) => setValues((s) => ({ ...s, day: day as WeekDay }))}>
            <SelectTrigger className="w-full" aria-label="Day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.full}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Period</Label>
          <Select value={values.period} onValueChange={(period) => setValues((s) => ({ ...s, period }))}>
            <SelectTrigger className="w-full" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: MAX_PERIOD }, (_, i) => i + 1).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  Period {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tt-start">Start time</Label>
          <Input
            id="tt-start"
            type="time"
            value={values.startTime}
            onChange={(e) => setValues((s) => ({ ...s, startTime: e.target.value }))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tt-end">End time</Label>
          <Input
            id="tt-end"
            type="time"
            value={values.endTime}
            onChange={(e) => setValues((s) => ({ ...s, endTime: e.target.value }))}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Subject *</Label>
          <Select
            value={values.subjectId}
            onValueChange={(subjectId) => setValues((s) => ({ ...s, subjectId }))}
          >
            <SelectTrigger className="w-full" aria-label="Subject">
              <SelectValue placeholder="Select subject of this class" />
            </SelectTrigger>
            <SelectContent>
              {(subjectsData?.subjects ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Teacher</Label>
          <Select
            value={values.teacherId}
            onValueChange={(teacherId) => setValues((s) => ({ ...s, teacherId: teacherId === "none" ? "" : teacherId }))}
          >
            <SelectTrigger className="w-full" aria-label="Teacher">
              <SelectValue placeholder="Optional — defaults to subject teacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No override</SelectItem>
              {(teachersData?.teachers ?? [])
                .filter((t) => t.status === "ACTIVE")
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.user.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FormDialog>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function TimetableAdminView() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [dialog, setDialog] = useState<{
    day: WeekDay;
    period: number;
    start: string;
    end: string;
  } | null>(null);

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const classes = classesData?.classes ?? [];
  // Derived default: first class until the user picks one (no effect needed).
  const effectiveClassId = classId || classes[0]?.id || "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timetable", { classId: effectiveClassId }],
    queryFn: () =>
      api.get<{ entries: TimetableEntryDTO[] }>(`/api/timetable?classId=${effectiveClassId}`),
    enabled: Boolean(effectiveClassId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/timetable/${id}`),
    onSuccess: () => {
      toast.success("Entry removed");
      void queryClient.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const cellMap = useMemo(() => {
    const map = new Map<string, TimetableEntryDTO>();
    for (const e of entries) map.set(`${e.day}-${e.period}`, e);
    return map;
  }, [entries]);

  const periods = useMemo(() => {
    const set = new Set(entries.map((e) => e.period));
    if (set.size === 0) return Array.from({ length: 7 }, (_, i) => i + 1);
    return Array.from(set).sort((a, b) => a - b);
  }, [entries]);

  const periodTimes = useMemo(() => {
    const map = new Map<number, { start: string; end: string }>();
    for (const e of entries) {
      if (!map.has(e.period)) map.set(e.period, { start: e.startTime, end: e.endTime });
    }
    return map;
  }, [entries]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Timetable"
        subtitle="Weekly class schedule — Sunday to Thursday"
        actions={
          <Select value={effectiveClassId} onValueChange={setClassId}>
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

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !effectiveClassId ? (
        <EmptyState icon={CalendarDays} title="No classes yet" description="Create a class first to build its timetable." />
      ) : (
        <div className="scrollbar-thin overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Period
                </th>
                {DAYS.map((d) => (
                  <th key={d.value} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                        <p className="text-[10px] text-muted-foreground">
                          {formatTime(times.start)}–{formatTime(times.end)}
                        </p>
                      ) : null}
                    </td>
                    {DAYS.map((d) => {
                      const entry = cellMap.get(`${d.value}-${p}`);
                      return (
                        <td key={d.value} className="px-2 py-2 align-top">
                          {entry ? (
                            <div className="group relative rounded-md border border-emerald-200 bg-emerald-50 p-2 pr-6 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                              <p className="truncate text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                                {entry.subject?.name ?? "—"}
                              </p>
                              <p className="truncate text-[10px] text-emerald-700/70 dark:text-emerald-400/70">
                                {entry.teacher?.name ?? "No teacher"}
                              </p>
                              <button
                                type="button"
                                aria-label={`Delete ${entry.subject?.name ?? "entry"} on ${d.label} period ${p}`}
                                className="absolute right-1 top-1 rounded p-0.5 text-emerald-700/50 opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100 dark:text-emerald-400/50"
                                onClick={() => deleteMutation.mutate(entry.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <X className="size-3.5" aria-hidden />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="flex h-[52px] w-full items-center justify-center rounded-md border border-dashed text-muted-foreground/40 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                              aria-label={`Add entry on ${d.label} period ${p}`}
                              onClick={() =>
                                setDialog({
                                  day: d.value,
                                  period: p,
                                  start: periodTimes.get(p)?.start ?? "09:00",
                                  end: periodTimes.get(p)?.end ?? "09:45",
                                })
                              }
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
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
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Trash2 className="size-3" aria-hidden />
        Hover a filled cell to reveal its delete button; click any empty slot to add a period.
      </p>

      {dialog ? (
        <TimetableEntryDialog
          onOpenChange={(open) => !open && setDialog(null)}
          classId={effectiveClassId}
          initialDay={dialog.day}
          initialPeriod={dialog.period}
          defaultStart={dialog.start}
          defaultEnd={dialog.end}
        />
      ) : null}
    </div>
  );
}
