"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GraduationCap, Info, ListChecks, Loader2, Save, Sigma, TriangleAlert } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { ExamDTO, MarksRosterResponse, SubjectDTO } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader, ScrollTable } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/app-store";
import type { MyClass } from "./common";
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

/** Empty string = not entered (skipped on save). Anything else must be 0–100. */
function invalidMarks(v: string): boolean {
  if (v.trim() === "") return false;
  const n = Number(v);
  return Number.isNaN(n) || n < 0 || n > 100;
}

export function TeacherMarksView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Initial class seeded from an "Enter marks" quick action (app-store preselect)
  const [classId, setClassId] = useState(() => useAppStore.getState().marksPreselect ?? "");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  /**
   * Unsaved mark edits as an overlay on top of the server roster, keyed by
   * "examId|subjectId". No effects needed: when the roster changes the key
   * stops matching and the overlay falls away; "" means explicitly cleared.
   */
  const [edits, setEdits] = useState<{ key: string; values: Record<string, string> }>({
    key: "",
    values: {},
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ["teacher", "my-classes"],
    queryFn: () => api.get<{ classes: MyClass[] }>("/api/teachers/me/classes"),
  });
  const classes = classesData?.classes ?? [];
  const effectiveClassId = classes.some((c) => c.id === classId) ? classId : (classes[0]?.id ?? "");

  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ["exams", { classId: effectiveClassId }],
    queryFn: () => api.get<{ exams: ExamDTO[] }>(`/api/exams?classId=${effectiveClassId}`),
    enabled: Boolean(effectiveClassId),
  });
  const exams = examsData?.exams ?? [];
  const effectiveExamId = exams.some((e) => e.id === examId) ? examId : (exams[0]?.id ?? "");

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", { classId: effectiveClassId }],
    queryFn: () => api.get<{ subjects: SubjectDTO[] }>(`/api/subjects?classId=${effectiveClassId}`),
    enabled: Boolean(effectiveClassId),
  });
  const allSubjects = subjectsData?.subjects ?? [];
  const mySubjects = allSubjects.filter((s) => s.teacher?.id === user?.id);
  // Only subjects assigned to me — fall back to the full class list when I teach none here.
  const subjectOptions = mySubjects.length > 0 ? mySubjects : allSubjects;
  const effectiveSubjectId = subjectOptions.some((s) => s.id === subjectId)
    ? subjectId
    : (subjectOptions[0]?.id ?? "");

  const roster = useQuery({
    queryKey: ["teacher", "marks", { examId: effectiveExamId, subjectId: effectiveSubjectId }],
    queryFn: () =>
      api.get<MarksRosterResponse>(`/api/results${toQuery({ examId: effectiveExamId, subjectId: effectiveSubjectId })}`),
    enabled: Boolean(effectiveExamId && effectiveSubjectId),
    staleTime: 60_000,
  });

  const marksRows = roster.data?.records ?? [];

  // Effective input value = user edit (if any) overlaid on the server roster value.
  const draftKey = `${effectiveExamId}|${effectiveSubjectId}`;
  const editValues = edits.key === draftKey ? edits.values : {};

  function valueOf(studentId: string, serverMarks: number | null): string {
    const v = editValues[studentId];
    if (v !== undefined) return v;
    return serverMarks === null ? "" : String(serverMarks);
  }

  // Plain derivation — the React Compiler memoizes; rosters are small anyway.
  const stats = (() => {
    const valid: { studentId: string; marks: number }[] = [];
    let invalid = 0;
    for (const r of marksRows) {
      const v = valueOf(r.studentId, r.marks).trim();
      if (v === "") continue;
      const n = Number(v);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        invalid += 1;
        continue;
      }
      valid.push({ studentId: r.studentId, marks: n });
    }
    const average = valid.length > 0 ? valid.reduce((sum, v) => sum + v.marks, 0) / valid.length : null;
    return { valid, invalid, average };
  })();

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post<{ saved: number }>("/api/results", {
        examId: effectiveExamId,
        subjectId: effectiveSubjectId,
        marks: stats.valid,
      }),
    onSuccess: (res) => {
      toast.success(`${res.saved} result${res.saved === 1 ? "" : "s"} saved`);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "marks"] });
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectedExam = exams.find((e) => e.id === effectiveExamId);
  const selectedSubject = subjectOptions.find((s) => s.id === effectiveSubjectId);

  const filters = (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-2">
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
        <div className="grid gap-2">
          <Label>Exam</Label>
          <Select
            value={effectiveExamId}
            onValueChange={setExamId}
            disabled={exams.length === 0}
          >
            <SelectTrigger className="w-full" aria-label="Choose exam">
              <SelectValue placeholder={examsLoading ? "Loading…" : "Choose exam"} />
            </SelectTrigger>
            <SelectContent>
              {exams.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
          <Label>Subject</Label>
          <Select
            value={effectiveSubjectId}
            onValueChange={setSubjectId}
            disabled={subjectOptions.length === 0}
          >
            <SelectTrigger className="w-full" aria-label="Choose subject">
              <SelectValue placeholder={subjectsLoading ? "Loading…" : "Choose subject"} />
            </SelectTrigger>
            <SelectContent>
              {subjectOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marks Entry"
        subtitle="Enter exam marks per subject — invalid or empty rows are skipped on save"
      />

      {classesLoading ? (
        <LoadingState rows={4} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes assigned yet"
          description="Marks entry opens up once the office assigns you to a class."
        />
      ) : (
        <>
          {filters}

          {mySubjects.length === 0 && allSubjects.length > 0 ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                You have no subjects assigned to you in this class — showing all subjects so you can still view or
                enter marks.
              </span>
            </div>
          ) : null}

          {exams.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No exams for this class"
              description="Marks can be entered once the office schedules an exam for this class."
            />
          ) : subjectOptions.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No subjects in this class"
              description="Subjects must exist before marks can be entered."
            />
          ) : roster.isLoading ? (
            <LoadingState rows={6} />
          ) : roster.error ? (
            <LoadError message={(roster.error as Error).message} onRetry={() => void roster.refetch()} />
          ) : marksRows.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No active students in this class"
              description="The marks roster will appear once students are enrolled."
            />
          ) : (
            <>
              <ScrollTable maxHeight="max-h-[520px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead className="w-16">Roll</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="w-32 text-right">Marks (0–100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marksRows.map((r) => {
                      const value = valueOf(r.studentId, r.marks);
                      const invalid = invalidMarks(value);
                      return (
                        <TableRow key={r.studentId} className={cn(value === "" && "bg-muted/20")}>
                          <TableCell className="font-medium tabular-nums">{r.rollNumber}</TableCell>
                          <TableCell className="font-medium">{r.studentName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={100}
                              step={1}
                              value={value}
                              onChange={(e) =>
                                setEdits({ key: draftKey, values: { ...editValues, [r.studentId]: e.target.value } })
                              }
                              aria-invalid={invalid}
                              aria-label={`Marks for ${r.studentName}`}
                              placeholder="—"
                              className={cn(
                                "ml-auto w-24 text-right tabular-nums",
                                invalid && "border-rose-400 text-rose-700 focus-visible:ring-rose-300 dark:text-rose-400"
                              )}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollTable>

              {/* Sticky save bar */}
              <div className="sticky bottom-4 z-10">
                <Card className="border-emerald-200/70 bg-card/95 shadow-lg backdrop-blur dark:border-emerald-500/25">
                  <CardContent className="flex flex-wrap items-center gap-2 p-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {stats.valid.length}/{marksRows.length} entered
                    </span>
                    {stats.invalid > 0 ? (
                      <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium tabular-nums text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                        <TriangleAlert className="size-3" aria-hidden />
                        {stats.invalid} invalid
                      </span>
                    ) : null}
                    {stats.average !== null ? (
                      <span className="flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium tabular-nums text-teal-700 dark:bg-teal-500/15 dark:text-teal-400">
                        <Sigma className="size-3" aria-hidden />
                        avg {stats.average.toFixed(1)}
                      </span>
                    ) : null}
                    {selectedExam && selectedSubject ? (
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {selectedExam.name} · {selectedSubject.name}
                      </span>
                    ) : null}
                    <Button
                      className="ml-auto"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || stats.valid.length === 0}
                      title={stats.valid.length === 0 ? "Enter at least one valid mark first" : undefined}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Save className="size-4" aria-hidden />
                      )}
                      Save marks
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
