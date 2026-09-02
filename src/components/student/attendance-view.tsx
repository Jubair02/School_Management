"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, ClipboardCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import type { AttendanceStatus, AttendanceSummary, WeekDay } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  ScrollTable,
  StatCard,
  StatusBadge,
  formatDate,
} from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DAY_ORDER: WeekDay[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

/** SVG progress ring for the overall attendance percentage. */
function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" role="img" aria-label={`Attendance ${Math.round(clamped)} percent`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{Math.round(clamped)}%</span>
        <span className="text-xs text-muted-foreground">attendance</span>
      </div>
    </div>
  );
}

function weekdayOf(iso: string): WeekDay {
  // Attendance dates are UTC-midnight normalized — read the weekday in UTC.
  const name = new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return name.toUpperCase() as WeekDay;
}

export function StudentAttendanceView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["attendance", "summary", "self"],
    queryFn: () => api.get<AttendanceSummary>("/api/attendance/summary"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="My Attendance" subtitle="How often you have been in class" />
        <LoadingState variant="cards" rows={4} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return null;

  const summary: AttendanceSummary = data;
  const hasRecords = summary.total > 0;

  // Present vs absent counts per weekday over the recent records
  const byDay = new Map<WeekDay, { present: number; absent: number }>();
  for (const rec of summary.recent) {
    const day = weekdayOf(rec.date);
    const entry = byDay.get(day) ?? { present: 0, absent: 0 };
    if (rec.status === "ABSENT") entry.absent += 1;
    else if (rec.status === "PRESENT") entry.present += 1;
    byDay.set(day, entry);
  }
  const chartData = DAY_ORDER.filter((d) => byDay.has(d)).map((d) => ({
    day: d.charAt(0) + d.slice(1, 3).toLowerCase(),
    Present: byDay.get(d)?.present ?? 0,
    Absent: byDay.get(d)?.absent ?? 0,
  }));

  const recent = [...summary.recent].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="space-y-4">
      <PageHeader title="My Attendance" subtitle="How often you have been in class" />

      {!hasRecords ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No attendance recorded yet"
          description="Once your teachers start marking attendance, your summary will appear here."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Ring */}
            <Card className="flex flex-col items-center justify-center gap-2 py-6">
              <ProgressRing pct={summary.percentage} />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{summary.present}</span> of{" "}
                <span className="font-semibold text-foreground">{summary.total}</span> marked days present
              </p>
            </Card>

            {/* Weekday chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Present vs absent by weekday</CardTitle>
                <p className="text-xs text-muted-foreground">Based on your last {summary.recent.length} marked days</p>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <EmptyState title="Nothing to chart yet" description="Weekday patterns appear once attendance is marked." />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tick={tickStyle} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Present" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                      <Bar dataKey="Absent" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status counts */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={CalendarCheck}
              label="Present"
              value={summary.present}
              sub="Days attended"
              tone="emerald"
            />
            <StatCard icon={CalendarCheck} label="Absent" value={summary.absent} sub="Days missed" tone="rose" />
            <StatCard icon={CalendarCheck} label="Late" value={summary.late} sub="Arrived late" tone="amber" />
            <StatCard icon={CalendarCheck} label="Leave" value={summary.leave} sub="Approved leave" tone="orange" />
          </div>

          {/* Recent records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent records</CardTitle>
              <p className="text-xs text-muted-foreground">Your last {recent.length} marked days, newest first</p>
            </CardHeader>
            <CardContent>
              <ScrollTable maxHeight="max-h-[360px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Weekday</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((rec) => {
                      const d = new Date(rec.date);
                      return (
                        <TableRow key={`${rec.date}-${rec.status}`}>
                          <TableCell className="whitespace-nowrap text-sm">{formatDate(rec.date)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {Number.isNaN(d.getTime())
                              ? "—"
                              : d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={rec.status as AttendanceStatus} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollTable>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
