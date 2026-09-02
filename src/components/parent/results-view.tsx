"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, UsersRound } from "lucide-react";
import { api, toQuery } from "@/lib/client-api";
import type { ExamDTO, StudentDetailDTO, StudentResultSheet } from "@/lib/types";
import { EmptyState, LoadingState, LoadError, PageHeader } from "@/components/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResultSheet } from "@/components/student/result-sheet";
import { useParentDashboard } from "./use-parent";
import { parentSelection } from "./selection";

export function ParentResultsView() {
  const [childId, setChildId] = useState("");
  const [examId, setExamId] = useState("");

  const dashboard = useParentDashboard();
  const children = useMemo(() => dashboard.data?.children ?? [], [dashboard.data]);

  // Initial child: remembered from parent:children, else the first child
  const activeChildId = useMemo(() => {
    if (childId && children.some((c) => c.student.id === childId)) return childId;
    const remembered = parentSelection.resultsChildId;
    if (remembered && children.some((c) => c.student.id === remembered)) return remembered;
    return children[0]?.student.id ?? "";
  }, [childId, children]);

  const activeChild = children.find((c) => c.student.id === activeChildId);

  // Child detail → class id (ChildOverview only carries className)
  const detailQuery = useQuery({
    queryKey: ["student", "detail", activeChildId],
    queryFn: () => api.get<{ student: StudentDetailDTO }>(`/api/students/${activeChildId}`),
    enabled: Boolean(activeChildId),
  });
  const classId = detailQuery.data?.student.class?.id ?? "";

  const examsQuery = useQuery({
    queryKey: ["exams", classId],
    queryFn: () => api.get<{ exams: ExamDTO[] }>(`/api/exams${toQuery({ classId })}`),
    enabled: Boolean(classId),
  });
  const exams = useMemo(() => examsQuery.data?.exams ?? [], [examsQuery.data]);

  // Prefer the newest exam with published results for this class
  const defaultExamId = useMemo(() => {
    if (exams.length === 0) return "";
    const withResults = exams
      .filter((e) => e.resultCount > 0)
      .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
    return (withResults[0] ?? exams[0]).id;
  }, [exams]);

  const activeExamId = examId && exams.some((e) => e.id === examId) ? examId : defaultExamId;

  const sheetQuery = useQuery({
    queryKey: ["results", "student", { studentId: activeChildId, examId: activeExamId }],
    queryFn: () =>
      api.get<{ sheet: StudentResultSheet }>(
        `/api/results/student${toQuery({ studentId: activeChildId, examId: activeExamId })}`
      ),
    enabled: Boolean(activeChildId && activeExamId),
  });

  const loading =
    dashboard.isLoading ||
    (Boolean(dashboard.data) && detailQuery.isFetching && !detailQuery.data) ||
    (Boolean(classId) && examsQuery.isFetching && !examsQuery.data);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Results" subtitle="Exam mark sheets for your children" />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (dashboard.error) {
    return <LoadError message={(dashboard.error as Error).message} onRetry={() => void dashboard.refetch()} />;
  }
  if (detailQuery.error) {
    return <LoadError message={(detailQuery.error as Error).message} onRetry={() => void detailQuery.refetch()} />;
  }

  const childLabel = (id: string) => {
    const c = children.find((x) => x.student.id === id)?.student;
    return c ? `${c.name} · ${c.className}${c.sectionName ? `-${c.sectionName}` : ""}` : id;
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Results" subtitle="Exam mark sheets for your children" />

      {children.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No children linked to your account"
          description="Ask the school office to link your children to this parent account."
        />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={activeChildId} onValueChange={setChildId}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Select child">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.student.id} value={c.student.id}>
                    {childLabel(c.student.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activeExamId} onValueChange={setExamId} disabled={exams.length === 0}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Select exam">
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
          </div>

          {!detailQuery.data?.student.class ? (
            <EmptyState
              icon={GraduationCap}
              title="No class assigned"
              description={`${activeChild?.student.name ?? "This child"} is not enrolled in a class yet, so there are no results to show.`}
            />
          ) : exams.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No exams scheduled yet"
              description={`No exams have been scheduled for ${activeChild?.student.name ?? "this child"}'s class.`}
            />
          ) : sheetQuery.isFetching && !sheetQuery.data ? (
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
