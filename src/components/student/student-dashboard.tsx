"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Award,
  CalendarClock,
  ClipboardCheck,
  Megaphone,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { StudentDashboard as StudentDashboardData } from "@/lib/types";
import {
  LoadingState,
  LoadError,
  PageHeader,
  StatCard,
  StatusBadge,
  formatCurrency,
  formatDate,
} from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStudentDashboard } from "./use-student";
import { GradeBadge } from "./result-sheet";

function CardEmpty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

export function StudentDashboardView() {
  const { data, isLoading, error, refetch } = useStudentDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={4} />
        <LoadingState variant="list" rows={3} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { student, stats, todaySchedule, upcomingExams, recentResults, announcements } = data;
  const month = stats.attendanceThisMonth;
  const gpaValue = stats.gpa == null ? "—" : stats.gpa.toFixed(2);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Your attendance, results and school updates at a glance" />

      {/* Greeting banner */}
      <Card className="overflow-hidden border-none bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
        <CardContent className="p-6">
          <p className="text-sm text-white/75">Welcome back,</p>
          <h3 className="mt-0.5 text-2xl font-bold tracking-tight">{student.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              {student.className}
              {student.sectionName ? ` · Section ${student.sectionName}` : ""}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">Roll {student.rollNumber}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-medium">{student.studentId}</span>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardCheck}
          label="Attendance"
          value={`${stats.attendancePct}%`}
          sub={month.total > 0 ? `${month.present}/${month.total} days this month` : "No classes marked yet"}
          tone="emerald"
        />
        <StatCard icon={Award} label="GPA" value={gpaValue} sub="Cumulative grade point average" tone="teal" />
        <StatCard
          icon={Wallet}
          label="Pending fees"
          value={formatCurrency(stats.pendingFees)}
          sub="Due to the school office"
          tone={stats.pendingFees > 0 ? "rose" : "slate"}
        />
        <StatCard
          icon={CalendarClock}
          label="Upcoming exams"
          value={stats.upcomingExams}
          sub={stats.upcomingExams === 1 ? "Exam scheduled ahead" : "Exams scheduled ahead"}
          tone="amber"
        />
      </div>

      {/* Today + upcoming exams */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&rsquo;s classes</CardTitle>
          </CardHeader>
          <CardContent>
            {todaySchedule.length === 0 ? (
              <CardEmpty text="No classes scheduled for today." />
            ) : (
              <ul className="space-y-2">
                {todaySchedule.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      P{e.period}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.subject?.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.teacher?.name ?? "Unassigned"}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {e.startTime}–{e.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming exams</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <CardEmpty text="No exams scheduled ahead." />
            ) : (
              <ul className="space-y-2">
                {upcomingExams.map((exam) => (
                  <li key={exam.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{exam.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {exam.className} · {formatDate(exam.startDate)} – {formatDate(exam.endDate)}
                      </p>
                    </div>
                    <StatusBadge status={exam.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent results + announcements */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent results</CardTitle>
          </CardHeader>
          <CardContent>
            {recentResults.length === 0 ? (
              <CardEmpty text="No results published yet." />
            ) : (
              <ul className="space-y-2">
                {recentResults.map((r, i) => (
                  <li key={`${r.examName}-${r.subjectName}-${i}`} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.subjectName}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.examName}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{r.marks}</span>
                    <GradeBadge grade={r.grade} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-muted-foreground" aria-hidden />
              Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <CardEmpty text="No announcements right now." />
            ) : (
              <ul className="space-y-2">
                {announcements.slice(0, 4).map((a) => (
                  <li key={a.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{a.title}</p>
                      <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(a.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
