"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  Check,
  Clock,
  History,
  Plus,
  Search,
  Trash2,
  UserSearch,
  Wallet,
  X,
} from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type {
  FeeDTO,
  FeeListResponse,
  FeeStatus,
  FeeType,
  PaymentMethod,
  StudentDTO,
  StudentListResponse,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  StatCard,
  StatusBadge,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<FeeType, string> = {
  TUITION: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ADMISSION: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  EXAM: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  TRANSPORT: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  LIBRARY: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  OTHER: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
};

const FEE_TYPES: FeeType[] = ["TUITION", "ADMISSION", "EXAM", "TRANSPORT", "LIBRARY", "OTHER"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "BANK"];

interface SelectedStudent {
  id: string;
  name: string;
  studentId: string;
}

// ── Searchable student picker (Command + Popover) ─────────────

export function StudentPicker({
  selected,
  onSelect,
  placeholder = "All students",
  className,
}: {
  selected: SelectedStudent | null;
  onSelect: (student: SelectedStudent | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["students-lookup", search],
    queryFn: () => api.get<StudentListResponse>(`/api/students${toQuery({ query: search, pageSize: 8 })}`),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal sm:w-56", !selected && "text-muted-foreground", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserSearch className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {selected ? `${selected.name} (${selected.studentId})` : placeholder}
            </span>
          </span>
          {selected ? (
            <X
              className="size-4 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              aria-label="Clear selected student"
            />
          ) : (
            <Search className="size-4 shrink-0 opacity-50" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search students…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-60">
            {isFetching && !data ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">Searching…</div>
            ) : (data?.students.length ?? 0) === 0 ? (
              <CommandEmpty>No students found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {data?.students.map((s: StudentDTO) => (
                  <CommandItem
                    key={s.id}
                    value={s.id}
                    onSelect={() => {
                      onSelect({ id: s.id, name: s.user.name, studentId: s.studentId });
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check className={cn("mr-2 size-4", selected?.id === s.id ? "opacity-100" : "opacity-0")} aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{s.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.studentId}
                        {s.class ? ` · ${s.class.name}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── New fee dialog ────────────────────────────────────────────

function NewFeeDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  // Mounted only while open — initializers give a fresh form each time.
  const [student, setStudent] = useState<SelectedStudent | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<FeeType>("TUITION");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/api/fees", {
        studentId: student?.id,
        title: title.trim(),
        type,
        amount: Number(amount),
        dueDate,
      }),
    onSuccess: () => {
      toast.success("Fee created");
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const valid = student && title.trim() && Number(amount) > 0 && dueDate;

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="New fee"
      description="Bill a student for tuition, exams or other charges."
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) {
          toast.error("Fill in the student, title, a positive amount and a due date");
          return;
        }
        mutation.mutate();
      }}
      submitting={mutation.isPending}
      submitLabel="Create fee"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Student *</Label>
          <StudentPicker selected={student} onSelect={setStudent} placeholder="Search & select student" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="fee-title">Title *</Label>
            <Input
              id="fee-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. August tuition"
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeeType)}>
              <SelectTrigger className="w-full" aria-label="Fee type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fee-amount">Amount (৳) *</Label>
            <Input
              id="fee-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fee-due">Due date *</Label>
            <Input id="fee-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
      </div>
    </FormDialog>
  );
}

// ── Record payment dialog ─────────────────────────────────────

function PaymentDialog({ fee, onOpenChange }: { fee: FeeDTO; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const remaining = Math.max(0, fee.amount - fee.paidAmount);
  // Mounted only while open — initializers seed from the fee each time.
  const [amount, setAmount] = useState(String(remaining > 0 ? remaining : ""));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ fee: FeeDTO }>(`/api/fees/${fee.id}/payments`, {
        amount: Number(amount),
        method,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {fee.studentName} — {fee.title} ({formatCurrency(fee.amount)})
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(amount) || Number(amount) <= 0) {
              toast.error("Enter a positive amount");
              return;
            }
            mutation.mutate();
          }}
          className="grid gap-4"
        >
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
            Paid so far: <span className="font-semibold">{formatCurrency(fee.paidAmount)}</span> · Remaining:{" "}
            <span className="font-semibold">{formatCurrency(remaining)}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pay-amount">Amount (৳) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full" aria-label="Payment method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pay-note">Note</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note / receipt no."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Banknote className="size-4" aria-hidden />
              {mutation.isPending ? "Saving…" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Payments history dialog ───────────────────────────────────

function HistoryDialog({ fee, onOpenChange }: { fee: FeeDTO | null; onOpenChange: (open: boolean) => void }) {
  const payments = fee?.payments ?? [];
  return (
    <Dialog open={Boolean(fee)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-thin sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
          <DialogDescription>
            {fee ? `${fee.studentName} — ${fee.title}` : ""}
          </DialogDescription>
        </DialogHeader>
        {payments.length === 0 ? (
          <EmptyState title="No payments yet" description="Recorded payments will be listed here." />
        ) : (
          <ol className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Banknote className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {p.method}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────

export function FeesView() {
  const queryClient = useQueryClient();
  const [student, setStudent] = useState<SelectedStudent | null>(null);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [paying, setPaying] = useState<FeeDTO | null>(null);
  const [historyFor, setHistoryFor] = useState<FeeDTO | null>(null);
  const [deleting, setDeleting] = useState<FeeDTO | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["fees", { studentId: student?.id, status, type }],
    queryFn: () =>
      api.get<FeeListResponse>(
        `/api/fees${toQuery({ studentId: student?.id, status, type })}`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (fee: FeeDTO) => api.del(`/api/fees/${fee.id}`),
    onSuccess: () => {
      toast.success("Fee deleted");
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fees = data?.fees ?? [];
  const summary = data?.summary;
  const hasFilters = Boolean(student || status || type);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fees"
        subtitle="Invoices, payments and collections"
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" aria-hidden />
            New fee
          </Button>
        }
      />

      {/* Summary chips */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Total due"
          value={formatCurrency(summary?.totalDue ?? 0)}
          sub="Outstanding balance"
          tone="rose"
          loading={isLoading}
        />
        <StatCard
          icon={BadgeDollarSign}
          label="Collected"
          value={formatCurrency(summary?.totalCollected ?? 0)}
          sub="Payments received"
          tone="emerald"
          loading={isLoading}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={summary?.pendingCount ?? 0}
          sub="Unpaid invoices"
          tone="amber"
          loading={isLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={summary?.overdueCount ?? 0}
          sub="Past due date"
          tone="orange"
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <StudentPicker selected={student} onSelect={setStudent} />
        <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="PARTIAL">Partial</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FEE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStudent(null);
              setStatus("");
              setType("");
            }}
          >
            <X className="size-4" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : fees.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No fees found"
          description="No invoices match the current filters. Create a new fee to bill a student."
          action={
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New fee
            </Button>
          }
        />
      ) : (
        <ScrollTable>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Student</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{fee.studentName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{fee.studentCode}</p>
                  </TableCell>
                  <TableCell className="text-sm">{fee.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TYPE_STYLES[fee.type]}>
                      {fee.type.charAt(0) + fee.type.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-semibold tabular-nums">{formatCurrency(fee.amount)}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatCurrency(fee.paidAmount)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(fee.dueDate)}</TableCell>
                  <TableCell><StatusBadge status={fee.status as FeeStatus} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={fee.status === "PAID"}
                        onClick={() => setPaying(fee)}
                      >
                        <Banknote className="size-4" aria-hidden />
                        Payment
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Payment history for ${fee.title}`}
                        onClick={() => setHistoryFor(fee)}
                      >
                        <History className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        aria-label={`Delete ${fee.title}`}
                        onClick={() => setDeleting(fee)}
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

      {newOpen ? <NewFeeDialog onOpenChange={setNewOpen} /> : null}
      {paying ? <PaymentDialog fee={paying} onOpenChange={(open) => !open && setPaying(null)} /> : null}
      <HistoryDialog fee={historyFor} onOpenChange={(open) => !open && setHistoryFor(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete fee "${deleting?.title ?? ""}"?`}
        description="Recorded payments under this fee will also be removed. This cannot be undone."
        confirmLabel="Delete fee"
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting) : Promise.resolve())}
      />
    </div>
  );
}
