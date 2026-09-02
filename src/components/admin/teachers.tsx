"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus, UserCheck, UserX, UserCog } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { TeacherCreateInput, TeacherDTO, TeacherListResponse } from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  InitialAvatar,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  SearchInput,
  StatusBadge,
  formatDate,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const teacherFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Minimum 6 characters").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  department: z.string().optional(),
  joiningDate: z.string().optional(),
});
type TeacherFormValues = z.infer<typeof teacherFormSchema>;

function TeacherFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: TeacherDTO | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: { name: "", email: "", password: "", phone: "", department: "", joiningDate: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            name: editing.user.name,
            email: editing.user.email,
            password: "",
            phone: editing.user.phone ?? "",
            department: editing.department ?? "",
            joiningDate: editing.joiningDate ? editing.joiningDate.slice(0, 10) : "",
          }
        : { name: "", email: "", password: "", phone: "", department: "", joiningDate: "" }
    );
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (values: TeacherFormValues) => {
      const str = (v: string | undefined) => {
        const t = v?.trim();
        return t ? t : undefined;
      };
      const payload: TeacherCreateInput = { name: values.name.trim(), email: values.email.trim() };
      const password = str(values.password);
      if (password) payload.password = password;
      const phone = str(values.phone);
      if (phone) payload.phone = phone;
      const department = str(values.department);
      if (department) payload.department = department;
      if (values.joiningDate) payload.joiningDate = values.joiningDate;
      return editing
        ? api.put(`/api/teachers/${editing.id}`, payload)
        : api.post("/api/teachers", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Teacher updated" : "Teacher added");
      void queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
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
      title={editing ? "Edit teacher" : "Add teacher"}
      description={
        editing
          ? "Update the teacher's profile."
          : "Create a new teacher account. Default password is Teacher@123 if left blank."
      }
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      submitting={mutation.isPending}
      submitLabel={editing ? "Save changes" : "Create teacher"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tch-name">Full name *</Label>
          <Input id="tch-name" placeholder="e.g. Mahmudul Hasan" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tch-email">Email *</Label>
          <Input id="tch-email" type="email" placeholder="teacher@edusphere.test" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tch-password">{editing ? "New password" : "Password"}</Label>
          <Input
            id="tch-password"
            type="password"
            placeholder={editing ? "Leave blank to keep current" : "Default: Teacher@123"}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tch-phone">Phone</Label>
          <Input id="tch-phone" placeholder="+880 1XXX XXXXXX" {...form.register("phone")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tch-dept">Department</Label>
          <Input id="tch-dept" placeholder="e.g. Mathematics" {...form.register("department")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tch-join">Joining date</Label>
          <Input id="tch-join" type="date" {...form.register("joiningDate")} />
        </div>
      </div>
    </FormDialog>
  );
}

export function TeachersView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherDTO | null>(null);
  const [confirming, setConfirming] = useState<TeacherDTO | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "teachers", { search, status }],
    queryFn: () =>
      api.get<TeacherListResponse>(`/api/teachers${toQuery({ query: search, status })}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (t: TeacherDTO) =>
      api.put(`/api/teachers/${t.id}`, { status: t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: (_d, t) => {
      toast.success(t.status === "ACTIVE" ? "Teacher deactivated" : "Teacher activated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const teachers = data?.teachers ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teachers"
        subtitle={`${data?.total ?? 0} teacher${data?.total === 1 ? "" : "s"} on staff`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add teacher
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput onValueChange={setSearch} placeholder="Search teachers…" />
        <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No teachers found"
          description="Try adjusting the filters, or add a new teacher."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Add teacher
            </Button>
          }
        />
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Teacher</TableHead>
                <TableHead>Teacher ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Subjects</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={t.user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.teacherId}</TableCell>
                  <TableCell className="text-sm">{t.department ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {t.subjects.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None</span>
                    ) : (
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {t.subjects.slice(0, 2).map((s) => (
                          <span
                            key={s.id}
                            className="truncate rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-500/15 dark:text-teal-400"
                            title={`${s.name} (${s.className})`}
                          >
                            {s.name}
                          </span>
                        ))}
                        {t.subjects.length > 2 ? (
                          <span className="text-[10px] text-muted-foreground">+{t.subjects.length - 2}</span>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.classes.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="size-3.5 text-muted-foreground" aria-hidden />
                        {t.classes.length}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(t.joiningDate)}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${t.user.name}`}
                        onClick={() => {
                          setEditing(t);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t.status === "ACTIVE" ? `Deactivate ${t.user.name}` : `Activate ${t.user.name}`}
                        onClick={() => setConfirming(t)}
                      >
                        {t.status === "ACTIVE" ? (
                          <UserX className="size-4 text-rose-600 dark:text-rose-400" aria-hidden />
                        ) : (
                          <UserCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollTable>
      )}

      <TeacherFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming?.status === "ACTIVE" ? "Deactivate teacher?" : "Activate teacher?"}
        description={
          confirming?.status === "ACTIVE"
            ? `${confirming?.user.name} will lose portal access. You can reactivate later.`
            : `${confirming?.user.name} will regain portal access.`
        }
        confirmLabel={confirming?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={confirming?.status === "ACTIVE"}
        onConfirm={() => (confirming ? toggleMutation.mutateAsync(confirming) : Promise.resolve())}
      />
    </div>
  );
}
