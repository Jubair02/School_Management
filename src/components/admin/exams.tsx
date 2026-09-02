"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BarChart3, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type {
  ClassDTO,
  ExamDTO,
  ExamStatus,
  StudentListResponse,
  StudentResultSheet,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  StatusBadge,
  formatDate,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ── Add / edit exam dialog ────────────────────────────────────

const examSchema = z
  .object({
    name: z.string().min(2, "Exam name is required"),
    classId: z.string().min(1, "Pick a class"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED"]).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });
type ExamFormValues = z.infer<typeof examSchema>;

function ExamFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ExamDTO | null;
}) {
  const queryClient = useQueryClient();
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
    enabled: open,
  });

  const form = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: { name: "", classId: "", startDate: "", endDate: "", status: "SCHEDULED" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            name: editing.name,
            classId: editing.classId,
            startDate: editing.startDate.slice(0, 10),
            endDate: editing.endDate.slice(0, 10),
            status: editing.status as ExamStatus,
          }
        : { name: "", classId: "", startDate: "", endDate: "", status: "SCHEDULED" }
    );
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (values: ExamFormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      };
      if (values.status) payload.status = values.status;
      if (!editing) payload.classId = values.classId;
      return editing ? api.put(`/api/exams/${editing.id}`, payload) : api.post("/api/exams", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Exam updated" : "Exam created");
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit exam" : "Create exam"}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      submitting={mutation.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="ex-name">Exam name *</Label>
          <Input id="ex-name" placeholder="e.g. Final Term 2025" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Class *</Label>
          <Select
            value={form.watch("classId")}
            onValueChange={(v) => form.setValue("classId", v)}
            disabled={Boolean(editing)}
          >
            <SelectTrigger className="w-full" aria-label="Class">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {(classesData?.classes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.classId ? (
            <p className="text-xs text-destructive">{form.formState.errors.classId.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select
            value={form.watch("status") ?? "SCHEDULED"}
            onValueChange={(v) => form.setValue("status", v as ExamStatus)}
          >
            <SelectTrigger className="w-full" aria-label="Exam status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="ONGOING">Ongoing</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ex-start">Start date *</Label>
          <Input id="ex-start" type="date" {...form.register("startDate")} />
          {form.formState.errors.startDate ? (
            <p className="text-xs text-destructive">{form.formState.errors.startDate.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ex-end">End date *</Label>
          <Input id="ex-end" type="date" {...form.register("endDate")} />
          {form.formState.errors.endDate ? (
            <p className="text-xs text-destructive">{form.formState.errors.endDate.message}</p>
          ) : null}
        </div>
      </div>
    </FormDialog>
  );
}

// ── Results summary dialog ────────────────────────────────────

function ResultsDialog({ exam, onOpenChange }: { exam: ExamDTO | null; onOpenChange: (open: boolean) => void }) {
  const enabled = Boolean(exam && exam.resultCount > 0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["exam-results", exam?.id],
    queryFn: async () => {
      const roster = await api.get<StudentListResponse>(
        `/api/students${toQuery({ classId: exam?.classId, status: "ACTIVE", pageSize: 100 })}`
      );
      // N small calls are acceptable here; failures simply skip a student.
      const sheets = await Promise.all(
        roster.students.slice(0, 60).map((s) =>
          api
            .get<{ sheet: StudentResultSheet }>(
              `/api/results/student${toQuery({ studentId: s.id, examId: exam?.id })}`
            )
            .then((r) => r.sheet)
            .catch(() => null)
        )
      );
      return sheets.filter((s): s is StudentResultSheet => s !== null && s.results.length > 0);
    },
    enabled,
  });

  const ranked = (data ?? []).slice().sort((a, b) => b.gpa - a.gpa);

  return (
    <Dialog open={Boolean(exam)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Results — {exam?.name} <span className="text-muted-foreground">({exam?.className})</span>
          </DialogTitle>
          <DialogDescription>Overall GPA per student, ranked highest first.</DialogDescription>
        </DialogHeader>

        {!enabled && exam ? (
          <EmptyState
            icon={ClipboardList}
            title="No results published yet"
            description="Once teachers enter marks for this exam, the per-student summary will appear here."
          />
        ) : null}

        {enabled && isLoading ? <LoadingState rows={5} /> : null}
        {enabled && error ? <LoadError message={(error as Error).message} /> : null}

        {enabled && !isLoading && !error ? (
          ranked.length === 0 ? (
            <EmptyState title="No result sheets found" description="Marks may not have been entered for this exam." />
          ) : (
            <ScrollTable maxHeight="max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Average</TableHead>
                    <TableHead>GPA</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((sheet, i) => (
                    <TableRow key={sheet.student.id}>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{sheet.student.name}</TableCell>
                      <TableCell className="text-sm tabular-nums">{sheet.student.studentId}</TableCell>
                      <TableCell className="text-sm tabular-nums">{sheet.average.toFixed(1)}</TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">{sheet.gpa.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                          {sheet.overallGrade}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollTable>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function ExamsView() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExamDTO | null>(null);
  const [deleting, setDeleting] = useState<ExamDTO | null>(null);
  const [resultsFor, setResultsFor] = useState<ExamDTO | null>(null);

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["exams", { classId }],
    queryFn: () => api.get<{ exams: ExamDTO[] }>(`/api/exams${classId ? `?classId=${classId}` : ""}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (exam: ExamDTO) => api.del(`/api/exams/${exam.id}`),
    onSuccess: () => {
      toast.success("Exam deleted");
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exams = data?.exams ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exams"
        subtitle="Exam schedule and published results"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Create exam
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={classId} onValueChange={(v) => setClassId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by class">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {(classesData?.classes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{exams.length} exam{exams.length === 1 ? "" : "s"}</p>
      </div>

      {isLoading ? (
        <LoadingState rows={5} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No exams found"
          description="Create the first exam for a class to start collecting results."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Create exam
            </Button>
          }
        />
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Exam</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell className="text-sm font-medium">{exam.name}</TableCell>
                  <TableCell className="text-sm">{exam.className}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(exam.startDate)} → {formatDate(exam.endDate)}
                  </TableCell>
                  <TableCell><StatusBadge status={exam.status} /></TableCell>
                  <TableCell className="text-sm tabular-nums">{exam.resultCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResultsFor(exam)}
                      >
                        <BarChart3 className="size-4" aria-hidden />
                        Results
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${exam.name}`}
                        onClick={() => {
                          setEditing(exam);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        aria-label={`Delete ${exam.name}`}
                        onClick={() => setDeleting(exam)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      )}

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ResultsDialog exam={resultsFor} onOpenChange={(open) => !open && setResultsFor(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "exam"}?`}
        description="All results recorded for this exam will be removed. This cannot be undone."
        confirmLabel="Delete exam"
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting) : Promise.resolve())}
      />
    </div>
  );
}
