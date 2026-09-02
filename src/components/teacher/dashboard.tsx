"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Megaphone,
  PenLine,
  School,
  Users,
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { TeacherDashboard as TeacherDashboardData } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  StatCard,
  StatusBadge,
  formatDate,
  titleCase,
} from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/app-store";
import { formatTime } from "./common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TeacherDashboardView() {
  const { user } = useAuth();
  const setActiveView = useAppStore((s) => s.setActiveView);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["teacher", "dashboard"],
    queryFn: () => api.get<TeacherDashboardData>("/api/dashboard"),
  });

  function openAttendance(classId: string) {
    useAppStore.setState({ attendancePreselect: classId });
    setActiveView("teacher:attendance");
  }

  function openMarks(classId: string) {
    useAppStore.setState({ marksPreselect: classId });
    setActiveView("teacher:marks");
  }

  function openClassDetails(classId: string) {
    useAppStore.setState({ classesPreselect: classId });
    setActiveView("teacher:classes");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={4} />
        <LoadingState variant="cards" rows={3} />
        <LoadingState variant="list" rows={3} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { stats, myClasses, upcomingExams, todaySchedule, announcements } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user ? `Welcome back, ${user.name.split(" ")[0]}` : "Teacher Dashboard"}
        subtitle="Your classes, today's schedule and what needs your attention"
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={School} label="My Classes" value={stats.classes} sub="Classes you teach in" tone="emerald" />
        <StatCard icon={GraduationCap} label="Total Students" value={stats.students} sub="Across your classes" tone="teal" />
        <StatCard icon={CalendarClock} label="Today's Classes" value={stats.todayClasses} sub="Periods scheduled today" tone="amber" />
        <StatCard
          icon={ClipboardCheck}
          label="Pending Attendance"
          value={stats.pendingAttendance}
          sub={stats.pendingAttendance > 0 ? "Students not yet marked today" : "All marked for today"}
          tone={stats.pendingAttendance > 0 ? "orange" : "slate"}
        />
      </div>

      {/* My classes */}
      <section aria-label="My classes" className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">My classes</h3>
        {myClasses.length === 0 ? (
          <EmptyState
            icon={School}
            title="No classes assigned yet"
            description="Classes appear here once the office assigns you as a subject teacher or class teacher."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myClasses.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.subjectCount} subject
                        {c.subjectCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Users className="size-4" aria-hidden />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" onClick={() => openAttendance(c.id)}>
                      <ClipboardCheck className="size-4" aria-hidden />
                      Attendance
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openMarks(c.id)}>
                      <PenLine className="size-4" aria-hidden />
                      Marks
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => openClassDetails(c.id)}
                      aria-label={`Open details for ${c.name}`}
                    >
                      Details
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Today's schedule + upcoming exams */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Today&apos;s schedule
            </CardTitle>
            <p className="text-xs text-muted-foreground">Your periods for today, in order</p>
          </CardHeader>
          <CardContent>
            {todaySchedule.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No classes scheduled today"
                description="Enjoy the free day — your weekly timetable has the full picture."
                action={
                  <Button size="sm" variant="outline" onClick={() => setActiveView("teacher:timetable")}>
                    View timetable
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {todaySchedule.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <span className="text-[10px] font-medium leading-none text-muted-foreground">Period</span>
                      <span className="text-sm font-bold leading-tight">{e.period}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.subject?.name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{e.className}</p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">
                      {formatTime(e.startTime)} – {formatTime(e.endTime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Upcoming exams
            </CardTitle>
            <p className="text-xs text-muted-foreground">Scheduled and ongoing exams across your classes</p>
          </CardHeader>
          <CardContent>
            {upcomingExams.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No upcoming exams"
                description="When the office schedules an exam for one of your classes it will show up here."
              />
            ) : (
              <ul className="space-y-3">
                {upcomingExams.map((ex) => (
                  <li key={ex.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{ex.name}</p>
                      <StatusBadge status={ex.status} />
                      <span className="ml-auto text-[11px] text-muted-foreground">{ex.className}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(ex.startDate)} – {formatDate(ex.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Recent announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <EmptyState title="No announcements yet" description="School notices will show up here." />
          ) : (
            <ul className="space-y-3">
              {announcements.slice(0, 5).map((a) => (
                <li key={a.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {titleCase(a.targetAudience)}
                      {a.class ? ` · ${a.class.name}` : ""}
                    </span>
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
  );
}
