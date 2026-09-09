"use client";

import { useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText, ShieldCheck } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { AuditListResponse, AuditLogDTO } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  SearchInput,
  formatDateTime,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 40;
const ANY = "__any__";

/** Destructive and money/grade actions are tinted so they stand out when scanning. */
const ACTION_STYLES: Record<string, string> = {
  CREATE: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  UPDATE: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  DELETE: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  PAYMENT: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  GRADE: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  ATTENDANCE: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  LOGIN: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  LOGIN_FAILED: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  LOGOUT: "border-transparent bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  PASSWORD_CHANGE: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  PASSWORD_RESET: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "text-emerald-700 dark:text-emerald-400",
  TEACHER: "text-teal-700 dark:text-teal-400",
  STUDENT: "text-amber-700 dark:text-amber-400",
  PARENT: "text-orange-700 dark:text-orange-400",
  ANONYMOUS: "text-muted-foreground",
};

function actionLabel(action: string): string {
  return action.replace(/_/g, " ").toLowerCase();
}

/** Renders one side of a change as `field: value` lines. */
function PayloadBlock({ title, payload }: { title: string; payload: Record<string, unknown> | null }) {
  if (!payload || Object.keys(payload).length === 0) {
    return (
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">—</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="mt-1 grid gap-1">
        {Object.entries(payload).map(([key, value]) => (
          <div key={key} className="grid grid-cols-[8rem_1fr] gap-2 text-xs">
            <dt className="truncate font-medium text-muted-foreground">{key}</dt>
            <dd className="min-w-0 break-words font-mono text-[11px]">
              {value === null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EntryRow({ entry }: { entry: AuditLogDTO }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(entry.before || entry.after);

  return (
    <>
      <TableRow className={cn(hasDetail && "cursor-pointer")} onClick={() => hasDetail && setOpen((v) => !v)}>
        <TableCell className="w-6 align-top">
          {hasDetail ? (
            <button
              type="button"
              aria-label={open ? "Hide changes" : "Show changes"}
              aria-expanded={open}
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
            >
              {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            </button>
          ) : null}
        </TableCell>
        <TableCell className="whitespace-nowrap align-top text-xs tabular-nums text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </TableCell>
        <TableCell className="align-top">
          <p className="text-sm font-medium">{entry.actorName}</p>
          <p className={cn("text-[11px] font-medium", ROLE_STYLES[entry.actorRole] ?? "text-muted-foreground")}>
            {entry.actorRole.toLowerCase()}
          </p>
        </TableCell>
        <TableCell className="align-top">
          <Badge variant="outline" className={ACTION_STYLES[entry.action] ?? ""}>
            {actionLabel(entry.action)}
          </Badge>
        </TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">{entry.entity}</TableCell>
        <TableCell className="align-top text-sm">{entry.summary}</TableCell>
        <TableCell className="whitespace-nowrap align-top font-mono text-[11px] text-muted-foreground">
          {entry.ip ?? "—"}
        </TableCell>
      </TableRow>

      {open && hasDetail ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={6} className="pb-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <PayloadBlock title="Before" payload={entry.before} />
              <PayloadBlock title="After" payload={entry.after} />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function AuditLogView() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState(ANY);
  const [entity, setEntity] = useState(ANY);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin", "audit", { search, action, entity, from, to, page }],
    queryFn: () =>
      api.get<AuditListResponse>(
        `/api/audit${toQuery({
          query: search,
          action: action === ANY ? "" : action,
          entity: entity === ANY ? "" : entity,
          from,
          to,
          page,
          pageSize: PAGE_SIZE,
        })}`
      ),
    placeholderData: keepPreviousData,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = search !== "" || action !== ANY || entity !== ANY || from !== "" || to !== "";

  /** Any filter change invalidates the current page number. */
  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  // Stable identity: SearchInput debounces against this callback, so a new
  // function each render would keep restarting its timer.
  const onSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit Log"
        subtitle={`${total} recorded action${total === 1 ? "" : "s"} — who changed what, and when`}
      />

      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          This log is append-only — entries cannot be edited or deleted from the application. Grades,
          fee payments and deletions are recorded with the fields that changed.
        </span>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
            <Label>Search</Label>
            <SearchInput
              defaultValue={search}
              onValueChange={onSearch}
              placeholder="Summary or person…"
              ariaLabel="Search the audit log"
              className="sm:max-w-none"
            />
          </div>
          <div className="grid gap-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={reset(setAction)}>
              <SelectTrigger className="w-full" aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All actions</SelectItem>
                {(data?.facets.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Record type</Label>
            <Select value={entity} onValueChange={reset(setEntity)}>
              <SelectTrigger className="w-full" aria-label="Filter by record type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All types</SelectItem>
                {(data?.facets.entities ?? []).map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="audit-from">From</Label>
              <Input id="audit-from" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-to">To</Label>
              <Input id="audit-to" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState rows={8} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "No matching entries" : "Nothing recorded yet"}
          description={
            filtered
              ? "No actions match these filters. Try widening the date range or clearing the search."
              : "Actions are recorded as staff use the system — enrolments, grade entry, fee payments and deletions all appear here."
          }
          action={
            filtered ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setAction(ANY);
                  setEntity(ANY);
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ScrollTable maxHeight="max-h-[640px]">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead className="w-40">When</TableHead>
                  <TableHead className="w-40">Who</TableHead>
                  <TableHead className="w-28">Action</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead>What changed</TableHead>
                  <TableHead className="w-28">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </TableBody>
            </Table>
          </ScrollTable>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {totalPages} · {total} entr{total === 1 ? "y" : "ies"}
              {isFetching ? " · updating…" : ""}
            </p>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
