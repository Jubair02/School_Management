"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ClipboardCheck, PenLine, Users, UsersRound } from "lucide-react";
import { api } from "@/lib/client-api";
import type { StudentListResponse, SubjectDTO } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  StatusBadge,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { isMine, type MyClassesResponse } from "./common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TeacherClassesView() {
  const setActiveView = useAppStore((s) => s.setActiveView);
  // Preselected by the dashboard "Details" quick action; otherwise starts empty
  // and falls back to the first class.
  const [selectedId, setSelectedId] = useState(() => useAppStore.getState().takePreselect("classesPreselect") ?? "");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["teacher", "my-classes"],
    queryFn: () => api.get<MyClassesResponse>("/api/teachers/me/classes"),
  });

  const myTeacherId = data?.teacherId;
  const classes = data?.classes ?? [];
  const effectiveId = classes.some((c) => c.id === selectedId) ? selectedId : (classes[0]?.id ?? "");
  const selected = classes.find((c) => c.id === effectiveId);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["teacher", "students", { classId: effectiveId }],
    queryFn: () => api.get<StudentListResponse>(`/api/students?classId=${effectiveId}`),
    enabled: Boolean(effectiveId),
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["subjects", { classId: effectiveId }],
    queryFn: () => api.get<{ subjects: SubjectDTO[] }>(`/api/subjects?classId=${effectiveId}`),
    enabled: Boolean(effectiveId),
  });

  function openAttendance(classId: string) {
    useAppStore.setState({ attendancePreselect: classId });
    setActiveView("teacher:attendance");
  }

  function openMarks(classId: string) {
    useAppStore.setState({ marksPreselect: classId });
    setActiveView("teacher:marks");
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Classes" subtitle="Select a class to view its students and your subjects" />
        <LoadingState variant="cards" rows={4} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;

  const students = studentsData?.students ?? [];
  const subjects = subjectsData?.subjects ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Classes"
        subtitle="Select a class to view its roster and the subjects you teach — jump straight into attendance or marks"
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes assigned yet"
          description="Classes appear here once the office assigns you as a subject teacher or class teacher."
        />
      ) : (
        <>
          {/* Class cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((c) => {
              const active = c.id === effectiveId;
              return (
                <Card
                  key={c.id}
                  className={cn(
                    "transition-shadow",
                    active ? "border-emerald-300 ring-2 ring-emerald-500/40 dark:border-emerald-500/40" : "hover:shadow-sm"
                  )}
                >
                  <CardContent className="p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-pressed={active}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.subjectCount} subject
                            {c.subjectCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            active
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <UsersRound className="size-4" aria-hidden />
                        </div>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button size="sm" variant="outline" onClick={() => openAttendance(c.id)}>
                        <ClipboardCheck className="size-4" aria-hidden />
                        Take attendance
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openMarks(c.id)}>
                        <PenLine className="size-4" aria-hidden />
                        Enter marks
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Selected class details */}
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-5">
              {/* Students */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UsersRound className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    Students — {selected.name}
                    <Badge variant="secondary" className="ml-1 tabular-nums">
                      {students.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Full roster including inactive enrollments</p>
                </CardHeader>
                <CardContent>
                  {studentsLoading ? (
                    <LoadingState rows={4} />
                  ) : students.length === 0 ? (
                    <EmptyState
                      icon={UsersRound}
                      title="No students in this class"
                      description="Students will appear here as soon as they are enrolled."
                    />
                  ) : (
                    <ScrollTable maxHeight="max-h-[420px]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-card">
                          <TableRow>
                            <TableHead className="w-16">Roll</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium tabular-nums">{s.rollNumber}</TableCell>
                              <TableCell>
                                <p className="font-medium">{s.user.name}</p>
                                <p className="text-xs text-muted-foreground">{s.studentId}</p>
                              </TableCell>
                              <TableCell className="max-w-48 truncate text-muted-foreground">{s.user.email}</TableCell>
                              <TableCell className="text-right">
                                <StatusBadge status={s.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollTable>
                  )}
                </CardContent>
              </Card>

              {/* Subjects */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BookOpen className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    Subjects — {selected.name}
                    <Badge variant="secondary" className="ml-1 tabular-nums">
                      {subjects.length}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Subjects assigned to you here feed the Marks entry dropdown
                  </p>
                </CardHeader>
                <CardContent>
                  {subjectsLoading ? (
                    <LoadingState variant="list" rows={4} />
                  ) : subjects.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No subjects yet"
                      description="The office hasn't created subjects for this class."
                    />
                  ) : (
                    <ul className="max-h-[420px] space-y-2 overflow-y-auto scrollbar-thin">
                      {subjects.map((s) => {
                        const mine = isMine(s.teacher?.id, myTeacherId);
                        return (
                          <li
                            key={s.id}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3",
                              mine && "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                            )}
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400">
                              <BookOpen className="size-4" aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{s.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {s.code} · {s.teacher?.name ?? "Unassigned"}
                              </p>
                            </div>
                            {mine ? (
                              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                Me
                              </Badge>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
