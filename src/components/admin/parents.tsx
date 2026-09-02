"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, UserCheck, UserX, UsersRound } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { ParentCreateInput, ParentDTO, ParentListResponse } from "@/lib/types";
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
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const parentFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Minimum 6 characters").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
});
type ParentFormValues = z.infer<typeof parentFormSchema>;

function ParentFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ParentDTO | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: { name: "", email: "", password: "", phone: "", address: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            name: editing.user.name,
            email: editing.user.email,
            password: "",
            phone: editing.phone ?? editing.user.phone ?? "",
            address: editing.address ?? "",
          }
        : { name: "", email: "", password: "", phone: "", address: "" }
    );
  }, [open, editing, form]);

  const mutation = useMutation({
    mutationFn: (values: ParentFormValues) => {
      const str = (v: string | undefined) => {
        const t = v?.trim();
        return t ? t : undefined;
      };
      const payload: ParentCreateInput = { name: values.name.trim(), email: values.email.trim() };
      const password = str(values.password);
      if (password) payload.password = password;
      const phone = str(values.phone);
      if (phone) payload.phone = phone;
      const address = str(values.address);
      if (address) payload.address = address;
      return editing ? api.put(`/api/parents/${editing.id}`, payload) : api.post("/api/parents", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Parent updated" : "Parent added");
      void queryClient.invalidateQueries({ queryKey: ["admin", "parents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit parent" : "Add parent"}
      description={
        editing
          ? "Update the parent's contact profile."
          : "Create a parent account. Default password is Parent@123 if left blank."
      }
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      submitting={mutation.isPending}
      submitLabel={editing ? "Save changes" : "Create parent"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="pr-name">Full name *</Label>
          <Input id="pr-name" placeholder="e.g. Md. Siddique Ahmed" {...form.register("name")} />
          {form.formState.errors.name ? (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-email">Email *</Label>
          <Input id="pr-email" type="email" placeholder="parent@edusphere.test" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-password">{editing ? "New password" : "Password"}</Label>
          <Input
            id="pr-password"
            type="password"
            placeholder={editing ? "Leave blank to keep current" : "Default: Parent@123"}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pr-phone">Phone</Label>
          <Input id="pr-phone" placeholder="+880 1XXX XXXXXX" {...form.register("phone")} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pr-address">Address</Label>
          <Textarea id="pr-address" rows={2} placeholder="Home address" {...form.register("address")} />
        </div>
      </div>
    </FormDialog>
  );
}

export function ParentsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ParentDTO | null>(null);
  const [confirming, setConfirming] = useState<ParentDTO | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "parents", { search }],
    queryFn: () => api.get<ParentListResponse>(`/api/parents${toQuery({ query: search })}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: ParentDTO) => api.del(`/api/parents/${p.id}`),
    onSuccess: (_d, p) => {
      toast.success(p.user.status === "ACTIVE" ? "Parent deactivated" : "Parent activated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "parents"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const parents = data?.parents ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Parents"
        subtitle={`${data?.total ?? 0} parent${data?.total === 1 ? "" : "s"} registered`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Add parent
          </Button>
        }
      />

      <SearchInput onValueChange={setSearch} placeholder="Search parents…" />

      {isLoading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : parents.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No parents found"
          description="Try adjusting the search, or add a new parent."
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Add parent
            </Button>
          }
        />
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Parent</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Children</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parents.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <InitialAvatar name={p.user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{p.phone ?? p.user.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {p.children.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No children linked</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.children.map((c) => (
                          <span
                            key={c.id}
                            className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                            title={`${c.studentId}${c.className ? ` · ${c.className}${c.sectionName ? ` ${c.sectionName}` : ""}` : ""}`}
                          >
                            {c.name}
                            {c.className ? ` (${c.className}${c.sectionName ? ` ${c.sectionName}` : ""})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">{p.address ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Edit ${p.user.name}`}
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Deactivate ${p.user.name}`}
                        onClick={() => setConfirming(p)}
                      >
                        {p.user.status === "ACTIVE" ? (
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

      <ParentFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Deactivate parent?"
        description={`${confirming?.user.name} will lose portal access. Linked children are not affected.`}
        confirmLabel="Deactivate"
        onConfirm={() => (confirming ? toggleMutation.mutateAsync(confirming) : Promise.resolve())}
      />
    </div>
  );
}
