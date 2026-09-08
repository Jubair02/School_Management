"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  GraduationCap,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { ClassDTO, TeacherListResponse } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";

// ── Add / edit class dialog ───────────────────────────────────

const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  academicYear: z.string().min(4, "Academic year is required"),
});
type ClassFormValues = z.infer<typeof classSchema>;

function ClassFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ClassDTO | null;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: "", academicYear: String(new Date().getFullYear()) },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? { name: editing.name, academicYear: editing.academicYear }
        : { name: "", academicYear: String(new Date().getFullYear()) }
    );
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (values: ClassFormValues) =>
      editing
        ? api.put(`/api/classes/${editing.id}`, values)
        : api.post("/api/classes", values),
    onSuccess: () => {
      toast.success(editing ? "Class updated" : "Class added");
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit class" : "Add class"}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      submitting={mutation.isPending}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cls-name">Class name *</Label>
          <Input id="cls-name" placeholder="e.g. Grade 11" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cls-year">Academic year *</Label>
          <Input id="cls-year" placeholder="e.g. 2025" {...form.register("academicYear")} />
          {form.formState.errors.academicYear ? (
            <p className="text-xs text-destructive">{form.formState.errors.academicYear.message}</p>
          ) : null}
        </div>
      </div>
    </FormDialog>
  );
}

// ── Manage sections & class teachers ──────────────────────────

function ManageClassDialog({
  cls,
  onOpenChange,
}: {
  cls: ClassDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [sectionName, setSectionName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  /** Section being renamed inline: {id, name} while editing, null otherwise. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const { data: teachersData } = useQuery({
    queryKey: ["admin", "teachers", "options"],
    queryFn: () => api.get<TeacherListResponse>("/api/teachers"),
    enabled: Boolean(cls),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["classes"] });
  };

  const addSection = useMutation({
    mutationFn: () => api.post(`/api/classes/${cls?.id}/sections`, { name: sectionName.trim() }),
    onSuccess: () => {
      toast.success("Section added");
      setSectionName("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameSection = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      api.put(`/api/sections/${payload.id}`, { name: payload.name.trim() }),
    onSuccess: () => {
      toast.success("Section renamed");
      setRenaming(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeSection = useMutation({
    mutationFn: (id: string) => api.del(`/api/sections/${id}`),
    onSuccess: () => {
      toast.success("Section removed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignTeacher = useMutation({
    mutationFn: () => api.post(`/api/classes/${cls?.id}/teachers`, { teacherId }),
    onSuccess: () => {
      toast.success("Class teacher assigned");
      setTeacherId("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeTeacher = useMutation({
    mutationFn: (id: string) => api.del(`/api/classes/${cls?.id}/teachers?teacherId=${id}`),
    onSuccess: () => {
      toast.success("Class teacher removed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const availableTeachers = (teachersData?.teachers ?? []).filter(
    (t) => t.status === "ACTIVE" && !cls?.classTeachers.some((ct) => ct.id === t.id)
  );

  return (
    <Dialog open={Boolean(cls)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage {cls?.name}</DialogTitle>
          <DialogDescription>Sections and class teachers for this class.</DialogDescription>
        </DialogHeader>

        {cls ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold">Sections</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {cls.sections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No sections yet.</p>
                ) : (
                  cls.sections.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1.5 text-xs font-medium"
                    >
                      Section {s.name}
                      {/* Rename in place — deleting a section to fix a typo
                          would unlink every student assigned to it. */}
                      <button
                        type="button"
                        aria-label={`Rename section ${s.name}`}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400"
                        onClick={() => setRenaming({ id: s.id, name: s.name })}
                        disabled={renameSection.isPending}
                      >
                        <Pencil className="size-3" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove section ${s.name}`}
                        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
                        onClick={() => removeSection.mutate(s.id)}
                        disabled={removeSection.isPending}
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {renaming ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    value={renaming.name}
                    autoFocus
                    aria-label="New section name"
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renaming.name.trim()) renameSection.mutate(renaming);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => renameSection.mutate(renaming)}
                    disabled={!renaming.name.trim() || renameSection.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 flex gap-2">
                <Input
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="New section name, e.g. C"
                  className="max-w-48"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && sectionName.trim()) {
                      e.preventDefault();
                      addSection.mutate();
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!sectionName.trim() || addSection.isPending}
                  onClick={() => addSection.mutate()}
                >
                  <Plus className="size-4" aria-hidden />
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-semibold">Class teachers</p>
              <div className="mt-2 space-y-2">
                {cls.classTeachers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No class teacher assigned.</p>
                ) : (
                  cls.classTeachers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                      <p className="text-sm">{t.name}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-rose-600"
                        aria-label={`Remove ${t.name} as class teacher`}
                        onClick={() => removeTeacher.mutate(t.id)}
                        disabled={removeTeacher.isPending}
                      >
                        <X className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger className="w-full" aria-label="Select teacher to assign">
                    <SelectValue placeholder="Select a teacher…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.user.name}
                        {t.department ? ` — ${t.department}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!teacherId || assignTeacher.isPending} onClick={() => assignTeacher.mutate()}>
                  <Plus className="size-4" aria-hidden />
                  Assign
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function ClassesView() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassDTO | null>(null);
  const [managing, setManaging] = useState<ClassDTO | null>(null);
  const [deleting, setDeleting] = useState<ClassDTO | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const deleteMutation = useMutation({
    mutationFn: (cls: ClassDTO) => api.del(`/api/classes/${cls.id}`),
    onSuccess: () => {
      toast.success("Class deleted");
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const classes = data?.classes ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Classes"
        subtitle="Grades, sections and class teachers"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add class
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState variant="cards" rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No classes yet"
          description="Create the first class to start enrolling students."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Add class
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <GraduationCap className="size-5" aria-hidden />
                    </div>
                    <div>
                      <CardTitle className="text-base">{c.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Academic year {c.academicYear}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{c.studentCount} students</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 pb-3 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">{c.subjectCount}</span> subjects ·{" "}
                  <span className="font-medium text-foreground">{c.sections.length}</span> section
                  {c.sections.length === 1 ? "" : "s"}
                  {c.sections.length > 0 ? (
                    <span className="ml-1 text-xs">({c.sections.map((s) => s.name).join(", ")})</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground">
                  <Users className="mr-1 inline size-3.5" aria-hidden />
                  Class teacher{c.classTeachers.length === 1 ? "" : "s"}:{" "}
                  {c.classTeachers.length > 0 ? (
                    <span className="font-medium text-foreground">
                      {c.classTeachers.map((t) => t.name).join(", ")}
                    </span>
                  ) : (
                    "none"
                  )}
                </p>
              </CardContent>
              <CardFooter className="gap-1 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManaging(c)}
                >
                  <Settings2 className="size-4" aria-hidden />
                  Manage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-rose-600 hover:text-rose-700 dark:text-rose-400"
                  onClick={() => setDeleting(c)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <ClassFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ManageClassDialog cls={managing} onOpenChange={(open) => !open && setManaging(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "class"}?`}
        description="This permanently deletes the class along with its sections, subjects, exams and timetable entries. Students are unlinked, not deleted."
        confirmLabel="Delete class"
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting) : Promise.resolve())}
      />
    </div>
  );
}
