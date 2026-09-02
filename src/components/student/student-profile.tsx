"use client";

import { ClipboardCheck, GraduationCap, Mail, Phone, RefreshCw, Wallet } from "lucide-react";
import {
  EmptyState,
  InitialAvatar,
  LoadingState,
  LoadError,
  PageHeader,
  StatusBadge,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useStudentDashboard, useStudentDetail } from "./use-student";

export function StudentProfileView() {
  const dashboard = useStudentDashboard();
  const { data, isLoading, error, refetch, isFetching } = useStudentDetail(dashboard.data?.student.id);

  if (dashboard.isLoading || (isFetching && !data)) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Profile" subtitle="Your personal and academic information" />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (dashboard.error) {
    return <LoadError message={(dashboard.error as Error).message} onRetry={() => void dashboard.refetch()} />;
  }
  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;

  const s = data?.student;
  if (!s) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Profile" subtitle="Your personal and academic information" />
        <EmptyState
          title="Profile unavailable"
          description="We couldn't load your student record. Please try again or contact the school office."
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const att = s.attendanceSummary;
  const rows: { label: string; value: string }[] = [
    { label: "Student ID", value: s.studentId },
    { label: "Roll number", value: s.rollNumber },
    {
      label: "Class",
      value: s.class ? `${s.class.name}${s.section ? ` — Section ${s.section.name}` : ""}` : "Not assigned",
    },
    { label: "Date of birth", value: formatDate(s.dateOfBirth) },
    { label: "Gender", value: s.gender ? titleCase(s.gender) : "—" },
    { label: "Admission date", value: formatDate(s.admissionDate) },
    { label: "Guardian", value: s.parent?.name ?? "—" },
    { label: "Address", value: s.address ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="My Profile" subtitle="Your personal and academic information" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Identity + details */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <InitialAvatar name={s.user.name} className="size-16 text-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-bold tracking-tight">{s.user.name}</h3>
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  {s.user.email}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {s.user.phone ?? "—"}
                </p>
              </div>
            </div>

            <Separator />

            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Academic snapshot */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
                Attendance
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{Math.round(att.percentage)}%</p>
              <Progress value={att.percentage} className="mt-2" aria-label="Attendance percentage" />
              <p className="mt-2 text-xs text-muted-foreground">
                {att.present} of {att.total} marked days present
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="size-4 text-teal-700 dark:text-teal-400" aria-hidden />
                GPA
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {s.gpa == null ? "—" : s.gpa.toFixed(2)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Across all published exam results</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="size-4 text-amber-700 dark:text-amber-400" aria-hidden />
                Fees
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{formatCurrency(s.feeSummary.due)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Outstanding · {formatCurrency(s.feeSummary.totalDue)} billed in total
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
