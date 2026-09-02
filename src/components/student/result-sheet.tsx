"use client";

import { Award, Calculator, Percent, Trophy } from "lucide-react";
import type { StudentResultSheet as SheetDTO } from "@/lib/types";
import { InitialAvatar, ScrollTable, StatCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** BD SSC-style grade → soft badge colors (no blue/indigo). */
export const GRADE_STYLES: Record<string, string> = {
  "A+": "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  A: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "A-": "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  B: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  C: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  D: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  F: "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

export function GradeBadge({ grade, className }: { grade: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn(GRADE_STYLES[grade] ?? "text-muted-foreground", className)}>
      {grade}
    </Badge>
  );
}

/**
 * Read-only mark sheet shared by student:results and parent:results.
 * Expects a fully loaded StudentResultSheet (non-empty results).
 */
export function ResultSheet({ sheet }: { sheet: SheetDTO }) {
  const maxTotal = sheet.results.length * 100;
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <InitialAvatar name={sheet.student.name} className="size-12 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight">{sheet.student.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {sheet.student.studentId} · {sheet.student.className}
                {sheet.student.sectionName ? ` — Section ${sheet.student.sectionName}` : ""}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {sheet.exam.name}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-6 sm:gap-8">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">GPA</p>
              <p className="text-2xl font-bold tabular-nums">{sheet.gpa.toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Grade</p>
              <GradeBadge grade={sheet.overallGrade} className="px-3 py-1 text-base font-bold" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subject-wise table */}
      <ScrollTable maxHeight="max-h-[440px]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead>Subject</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Marks</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-right">GPA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.results.map((r) => (
              <TableRow key={r.subjectId}>
                <TableCell className="text-sm font-medium">{r.subjectName}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.subjectCode}</TableCell>
                <TableCell className="text-right text-sm font-semibold tabular-nums">
                  {r.marks}
                  <span className="text-xs font-normal text-muted-foreground"> / 100</span>
                </TableCell>
                <TableCell>
                  <GradeBadge grade={r.grade} />
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{r.gpa.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollTable>

      {/* Footer stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calculator}
          label="Total"
          value={sheet.total}
          sub={maxTotal > 0 ? `Out of ${maxTotal}` : undefined}
          tone="teal"
        />
        <StatCard
          icon={Percent}
          label="Average"
          value={sheet.average.toFixed(1)}
          sub="Marks per subject"
          tone="emerald"
        />
        <StatCard icon={Award} label="GPA" value={sheet.gpa.toFixed(2)} sub="Grade point average" tone="amber" />
        <StatCard
          icon={Trophy}
          label="Overall"
          value={sheet.overallGrade}
          sub="Final grade"
          tone={sheet.overallGrade === "F" ? "rose" : "slate"}
        />
      </div>
    </div>
  );
}
