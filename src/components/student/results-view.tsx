"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { ExamDTO, StudentResultSheet } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudentDashboard, useStudentDetail } from "./use-student";
import { ResultSheet } from "./result-sheet";

export function StudentResultsView() {
  const [examId, setExamId] = useState("");

  const dashboard = useStudentDashboard();
  const detail = useStudentDetail(dashboard.data?.student.id);
  const classId = detail.data?.student.class?.id ?? "";

  const examsQuery = useQuery({
    queryKey: ["exams", classId],
    queryFn: () => api.get<{ exams: ExamDTO[] }>(`/api/exams${toQuery({ classId })}`),
    enabled: Boolean(classId),
  });
  const exams = useMemo(() => examsQuery.data?.exams ?? [], [examsQuery.data]);

  // Prefer the newest exam that actually has published results
  const defaultExamId = useMemo(() => {
    if (exams.length === 0) return "";
    const withResults = exams
      .filter((e) => e.resultCount > 0)
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
    return (withResults[0] ?? exams[0]).id;
  }, [exams]);

  const activeExamId = examId && exams.some((e) => e.id === examId) ? examId : defaultExamId;

  const sheetQuery = useQuery({
    queryKey: ["results", "student", { examId: activeExamId }],
    queryFn: () => api.get<{ sheet: StudentResultSheet }>(`/api/results/student${toQuery({ examId: activeExamId })}`),
    enabled: Boolean(activeExamId),
  });

  const loading =
    dashboard.isLoading ||
    (Boolean(dashboard.data) && detail.isFetching && !detail.data) ||
    (Boolean(classId) && examsQuery.isFetching && !examsQuery.data);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Results" subtitle="Subject-wise marks, grades and GPA for each exam" />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (dashboard.error) {
    return <LoadError message={(dashboard.error as Error).message} onRetry={() => void dashboard.refetch()} />;
  }
  if (detail.error) {
    return <LoadError message={(detail.error as Error).message} onRetry={() => void detail.refetch()} />;
  }

  const noClass = !detail.data?.student.class;

  return (
    <div className="space-y-4">
      <PageHeader title="My Results" subtitle="Subject-wise marks, grades and GPA for each exam" />

      {noClass ? (
        <EmptyState
          icon={GraduationCap}
          title="No class assigned yet"
          description="You are not enrolled in a class, so there are no exams or results to show. Please contact the school office."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={activeExamId} onValueChange={setExamId}>
              <SelectTrigger className="w-full sm:w-72" aria-label="Select exam">
                <SelectValue placeholder={exams.length === 0 ? "No exams yet" : "Select exam"} />
              </SelectTrigger>
              <SelectContent>
                {exams.map((exam) => (
                  <SelectItem key={exam.id} value={exam.id}>
                    {exam.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {exams.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exams have been scheduled for your class yet.</p>
            ) : null}
          </div>

          {sheetQuery.isFetching && !sheetQuery.data ? (
            <LoadingState rows={5} />
          ) : sheetQuery.error ? (
            <LoadError message={(sheetQuery.error as Error).message} onRetry={() => void sheetQuery.refetch()} />
          ) : sheetQuery.data ? (
            sheetQuery.data.sheet.results.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Results not published yet"
                description={`Marks for ${sheetQuery.data.sheet.exam.name} have not been published. Please check back once teachers finish entering results.`}
              />
            ) : (
              <ResultSheet sheet={sheetQuery.data.sheet} />
            )
          ) : null}
        </>
      )}
    </div>
  );
}
