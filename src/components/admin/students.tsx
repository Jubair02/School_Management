"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type {
  ClassDTO,
  Gender,
  ParentListResponse,
  StudentCreateInput,
  StudentDTO,
  StudentDetailDTO,
  StudentListResponse,
} from "@/lib/types";
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
  formatCurrency,
  formatDate,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 10;

const studentFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Minimum 6 characters").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  parentId: z.string().optional(),
  rollNumber: z.string().optional(),
});
type StudentFormValues = z.infer<typeof studentFormSchema>;

function cleanPayload(values: StudentFormValues): StudentCreateInput {
  const str = (v: string | undefined) => {
    const t = v?.trim();
    return t ? t : undefined;
  };
  const out: StudentCreateInput = { name: values.name.trim(), email: values.email.trim() };
  const password = str(values.password);
  if (password) out.password = password;
  const phone = str(values.phone);
  if (phone) out.phone = phone;
  if (values.dateOfBirth) out.dateOfBirth = values.dateOfBirth;
  if (values.gender) out.gender = values.gender as Gender;
  const address = str(values.address);
  if (address) out.address = address;
  if (values.classId) out.classId = values.classId;
  if (values.sectionId) out.sectionId = values.sectionId;
  if (values.parentId) out.parentId = values.parentId;
  const roll = str(values.rollNumber);
  if (roll) out.rollNumber = roll;
  return out;
}

// ── Add / Edit dialog ─────────────────────────────────────────

function StudentFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StudentDTO | null;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
    enabled: open,
  });
  const { data: parentsData } = useQuery({
    queryKey: ["admin", "parents", "options"],
    queryFn: () => api.get<ParentListResponse>("/api/parents"),
    enabled: open,
  });

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      dateOfBirth: "",
      address: "",
      classId: "",
      sectionId: "",
      parentId: "",
      rollNumber: "",
    },
  });

  const classId = form.watch("classId");
  const sections = useMemo(
    () => classesData?.classes.find((c) => c.id === classId)?.sections ?? [],
    [classesData, classId]
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.user.name,
        email: editing.user.email,
        password: "",
        phone: editing.user.phone ?? "",
        dateOfBirth: editing.dateOfBirth ? editing.dateOfBirth.slice(0, 10) : "",
        gender: (editing.gender as Gender | null) ?? undefined,
        address: editing.address ?? "",
        classId: editing.class?.id ?? "",
        sectionId: editing.section?.id ?? "",
        parentId: editing.parent?.id ?? "",
        rollNumber: editing.rollNumber ?? "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        password: "",
        phone: "",
        dateOfBirth: "",
        address: "",
        classId: "",
        sectionId: "",
        parentId: "",
        rollNumber: "",
      });
    }
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (payload: StudentCreateInput) =>
      editing
        ? api.put<{ student: StudentDTO }>(`/api/students/${editing.id}`, payload)
        : api.post<{ student: StudentDTO }>("/api/students", payload),
    onSuccess: () => {
      toast.success(editing ? "Student updated" : "Student added");
      void queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit student" : "Add student"}
      description={
        editing
          ? "Update the student's profile. Leave the password blank to keep the current one."
          : "Create a new student account. Default password is Student@123 if left blank."
      }
      onSubmit={form.handleSubmit((values) => mutation.mutate(cleanPayload(values)))}
      submitting={mutation.isPending}
      submitLabel={editing ? "Save changes" : "Create student"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="st-name">Full name *</Label>
          <Input id="st-name" placeholder="e.g. Jubair Ahmed" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="st-email">Email *</Label>
          <Input id="st-email" type="email" placeholder="student@edusphere.test" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="st-password">{editing ? "New password" : "Password"}</Label>
          <Input
            id="st-password"
            type="password"
            placeholder={editing ? "Leave blank to keep current" : "Default: Student@123"}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="st-phone">Phone</Label>
          <Input id="st-phone" placeholder="+880 1XXX XXXXXX" {...form.register("phone")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="st-dob">Date of birth</Label>
          <Input id="st-dob" type="date" {...form.register("dateOfBirth")} />
        </div>
        <div className="grid gap-2">
          <Label>Gender</Label>
          <Controller
            control={form.control}
            name="gender"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => field.onChange(v === "" ? undefined : v)}
              >
                <SelectTrigger className="w-full" aria-label="Gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label>Class</Label>
          <Controller
            control={form.control}
            name="classId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => {
                  field.onChange(v === "" ? undefined : v);
                  form.setValue("sectionId", "");
                }}
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
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label>Section</Label>
          <Controller
            control={form.control}
            name="sectionId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => field.onChange(v === "" ? undefined : v)}
                disabled={!classId}
              >
                <SelectTrigger className="w-full" aria-label="Section">
                  <SelectValue placeholder={classId ? "Select section" : "Pick a class first"} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label>Parent / guardian</Label>
          <Controller
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(v) => field.onChange(v === "" ? undefined : v)}
              >
                <SelectTrigger className="w-full" aria-label="Parent or guardian">
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {(parentsData?.parents ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="st-roll">Roll number</Label>
          <Input id="st-roll" placeholder="e.g. 01" {...form.register("rollNumber")} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="st-address">Address</Label>
          <Textarea id="st-address" rows={2} placeholder="Home address" {...form.register("address")} />
        </div>
      </div>
    </FormDialog>
  );
}

// ── Detail dialog ─────────────────────────────────────────────

function StudentDetailDialog({ studentId, onOpenChange }: { studentId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "student", studentId],
    queryFn: () => api.get<{ student: StudentDetailDTO }>(`/api/students/${studentId}`),
    enabled: Boolean(studentId),
  });

  const s = data?.student;

  return (
    <Dialog open={Boolean(studentId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto scrollbar-thin sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Student profile</DialogTitle>
          <DialogDescription>Attendance, fees and academic summary.</DialogDescription>
        </DialogHeader>

        {isLoading ? <LoadingState variant="detail" /> : null}
        {error ? <LoadError message={(error as Error).message} /> : null}

        {s ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <InitialAvatar name={s.user.name} className="size-12 text-base" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-base font-semibold">
                  {s.user.name}
                  <StatusBadge status={s.status} />
                </p>
                <p className="truncate text-sm text-muted-foreground">{s.user.email}</p>
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Student ID:</span> <span className="font-mono text-xs">{s.studentId}</span></p>
              <p><span className="text-muted-foreground">Roll:</span> {s.rollNumber}</p>
              <p><span className="text-muted-foreground">Class:</span> {s.class ? `${s.class.name}${s.section ? ` — Section ${s.section.name}` : ""}` : "Unassigned"}</p>
              <p><span className="text-muted-foreground">Parent:</span> {s.parent?.name ?? "—"}</p>
              <p><span className="text-muted-foreground">Gender:</span> {s.gender ? s.gender.charAt(0) + s.gender.slice(1).toLowerCase() : "—"}</p>
              <p><span className="text-muted-foreground">Date of birth:</span> {formatDate(s.dateOfBirth)}</p>
              <p><span className="text-muted-foreground">Admitted:</span> {formatDate(s.admissionDate)}</p>
              <p><span className="text-muted-foreground">Phone:</span> {s.user.phone ?? "—"}</p>
              {s.address ? <p className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {s.address}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.attendanceSummary.percentage}%</p>
                <Progress value={s.attendanceSummary.percentage} className="mt-2 h-2" aria-label="Attendance percentage" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.attendanceSummary.present} present · {s.attendanceSummary.absent} absent · {s.attendanceSummary.late} late · {s.attendanceSummary.leave} leave
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GPA</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{s.gpa !== null ? s.gpa.toFixed(2) : "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fees due</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(s.feeSummary.due)}</p>
                  <p className="text-[11px] text-muted-foreground">of {formatCurrency(s.feeSummary.totalDue)} billed</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function StudentsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [classId, setClassIdFilter] = useState("");
  const [status, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentDTO | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<StudentDTO | null>(null);

  // Filters reset pagination directly in their setters (no effect needed)
  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }
  function updateClass(value: string) {
    setClassIdFilter(value);
    setPage(1);
  }
  function updateStatus(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "students", { search, classId, status, page }],
    queryFn: () =>
      api.get<StudentListResponse>(
        `/api/students${toQuery({ query: search, classId, status, page, pageSize: PAGE_SIZE })}`
      ),
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: StudentDTO) =>
      api.put(`/api/students/${s.id}`, { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    onSuccess: (_data, s) => {
      toast.success(s.status === "ACTIVE" ? "Student deactivated" : "Student activated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const students = data?.students ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Students"
        subtitle={`${total} student${total === 1 ? "" : "s"} in the school`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add student
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput onValueChange={updateSearch} placeholder="Search name, email or student ID…" />
        <Select value={classId} onValueChange={(v) => updateClass(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by class">
            <SelectValue placeholder="All classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {(classesData?.classes ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => updateStatus(v === "all" ? "" : v)}>
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
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Try adjusting the filters, or add a new student to get started."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              Add student
            </Button>
          }
        />
      ) : (
        <>
          <ScrollTable>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(s.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <InitialAvatar name={s.user.name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.studentId}</TableCell>
                    <TableCell className="text-sm">
                      {s.class ? `${s.class.name}${s.section ? ` · ${s.section.name}` : ""}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{s.rollNumber}</TableCell>
                    <TableCell className="text-sm">{s.parent?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Edit ${s.user.name}`}
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
                          className="size-8"
                          aria-label={s.status === "ACTIVE" ? `Deactivate ${s.user.name}` : `Activate ${s.user.name}`}
                          onClick={() => setConfirming(s)}
                        >
                          {s.status === "ACTIVE" ? (
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

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" aria-hidden />
                Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSaved={() => undefined}
      />
      <StudentDetailDialog studentId={detailId} onOpenChange={(open) => !open && setDetailId(null)} />
      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming?.status === "ACTIVE" ? "Deactivate student?" : "Activate student?"}
        description={
          confirming?.status === "ACTIVE"
            ? `${confirming?.user.name} will lose access to the portal. You can reactivate later.`
            : `${confirming?.user.name} will regain access to the portal.`
        }
        confirmLabel={confirming?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={confirming?.status === "ACTIVE"}
        onConfirm={() => (confirming ? toggleMutation.mutateAsync(confirming) : Promise.resolve())}
      />
    </div>
  );
}
