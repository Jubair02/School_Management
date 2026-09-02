"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type { ClassDTO, SubjectDTO, TeacherListResponse } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const UNASSIGNED = "__unassigned__";

const subjectSchema = z.object({
  name: z.string().min(2, "Subject name is required"),
  code: z.string().min(1, "Subject code is required"),
  classId: z.string().min(1, "Pick a class"),
  teacherId: z.string().optional(),
});
type SubjectFormValues = z.infer<typeof subjectSchema>;

function SubjectFormDialog({
  open,
  onOpenChange,
  editing,
  defaultClassId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SubjectDTO | null;
  defaultClassId: string;
}) {
  const queryClient = useQueryClient();
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
    enabled: open,
  });
  const { data: teachersData } = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: () => api.get<TeacherListResponse>("/api/teachers"),
    enabled: open,
  });

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { name: "", code: "", classId: "", teacherId: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? { name: editing.name, code: editing.code, classId: editing.classId, teacherId: editing.teacher?.id ?? "" }
        : { name: "", code: "", classId: defaultClassId, teacherId: "" }
    );
  }, [open, editing, defaultClassId, form]);

  const mutation = useMutation({
    mutationFn: (values: SubjectFormValues) => {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        classId: values.classId,
      };
      payload.teacherId = values.teacherId && values.teacherId !== UNASSIGNED ? values.teacherId : null;
      return editing
        ? api.put(`/api/subjects/${editing.id}`, payload)
        : api.post("/api/subjects", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Subject updated" : "Subject added");
      void queryClient.invalidateQueries({ queryKey: ["subjects"] });
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit subject" : "Add subject"}
      description={editing ? "Reassign the teacher or rename the subject." : undefined}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      submitting={mutation.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="sub-name">Subject name *</Label>
          <Input id="sub-name" placeholder="e.g. Higher Math" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sub-code">Code *</Label>
          <Input id="sub-code" placeholder="e.g. HM-265" {...form.register("code")} />
          {form.formState.errors.code ? (
            <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Class *</Label>
          <Controller
            control={form.control}
            name="classId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(editing)}>
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
            )}
          />
          {form.formState.errors.classId ? (
            <p className="text-xs text-destructive">{form.formState.errors.classId.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Teacher</Label>
          <Controller
            control={form.control}
            name="teacherId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => field.onChange(v === UNASSIGNED ? "" : v)}
              >
                <SelectTrigger className="w-full" aria-label="Assigned teacher">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {(teachersData?.teachers ?? [])
                    .filter((t) => t.status === "ACTIVE")
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.user.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </FormDialog>
  );
}

export function SubjectsView() {
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectDTO | null>(null);
  const [deleting, setDeleting] = useState<SubjectDTO | null>(null);

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["subjects", { classId }],
    queryFn: () => api.get<{ subjects: SubjectDTO[] }>(`/api/subjects${classId ? `?classId=${classId}` : ""}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (s: SubjectDTO) => api.del(`/api/subjects/${s.id}`),
    onSuccess: () => {
      toast.success("Subject deleted");
      void queryClient.invalidateQueries({ queryKey: ["subjects"] });
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const subjects = data?.subjects ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Subjects"
        subtitle="Curriculum per class with assigned teachers"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add subject
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
        <p className="text-sm text-muted-foreground">
          {subjects.length} subject{subjects.length === 1 ? "" : "s"}
        </p>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description="Add subjects to build each class's curriculum."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Add subject
            </Button>
          }
        />
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Subject</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {s.code}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.className}</TableCell>
                  <TableCell className="text-sm">
                    {s.teacher ? (
                      s.teacher.name
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${s.name}`}
                        onClick={() => {
                          setEditing(s);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => setDeleting(s)}
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

      <SubjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultClassId={classId}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "subject"}?`}
        description="Existing results for this subject will also be removed. This cannot be undone."
        confirmLabel="Delete subject"
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting) : Promise.resolve())}
      />
    </div>
  );
}
