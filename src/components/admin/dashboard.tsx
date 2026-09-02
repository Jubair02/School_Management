"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ClipboardCheck,
  GraduationCap,
  School,
  UserCog,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/client-api";
import type { AdminDashboard as AdminDashboardData } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  StatCard,
  formatCurrency,
  formatDate,
  titleCase,
} from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

const tickStyle = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

const GENDER_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

function dayLabel(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** "2026-04" → "Apr 26" (falls back to the raw value). */
function monthLabel(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? month
    : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function AdminDashboardView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<AdminDashboardData>("/api/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState variant="cards" rows={5} />
        <LoadingState variant="table" rows={3} />
      </div>
    );
  }

  if (error) return <LoadError message={(error as Error).message} onRetry={() => void refetch()} />;
  if (!data) return null;

  const { stats, charts, announcements } = data;
  const attendanceData = charts.attendanceTrend.map((t) => ({ label: dayLabel(t.date), percentage: t.percentage }));
  const hasAnyAttendance = attendanceData.some((d) => d.percentage > 0);
  // API returns raw enums / "YYYY-MM" — make them human-friendly for the charts
  const genderData = charts.gender.map((g) => ({ name: titleCase(g.name), value: g.value }));
  const feeData = charts.feeCollection.map((f) => ({ ...f, month: monthLabel(f.month) }));

  return (
    <div className="space-y-6">
      <PageHeader title="School Overview" subtitle="Live snapshot of students, staff, attendance and finances" />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={GraduationCap} label="Students" value={stats.students} sub="Enrolled students" tone="emerald" />
        <StatCard icon={UserCog} label="Teachers" value={stats.teachers} sub="Teaching staff" tone="teal" />
        <StatCard icon={School} label="Classes" value={stats.classes} sub="Active classes" tone="amber" />
        <StatCard
          icon={ClipboardCheck}
          label="Attendance"
          value={`${stats.todayAttendancePct}%`}
          sub={stats.todayAttendanceMarked > 0 ? `${stats.todayAttendanceMarked} marked today` : "Not marked yet today"}
          tone="orange"
        />
        <StatCard
          icon={Wallet}
          label="Pending fees"
          value={formatCurrency(stats.pendingFeeAmount)}
          sub={`${stats.pendingFeeCount} unpaid invoice${stats.pendingFeeCount === 1 ? "" : "s"}`}
          tone="rose"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance trend</CardTitle>
            <p className="text-xs text-muted-foreground">Present % across the last 7 school days</p>
          </CardHeader>
          <CardContent>
            {hasAnyAttendance ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={attendanceData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={tickStyle} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Present"]} />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#attFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No attendance recorded yet" description="The trend will appear once teachers start marking attendance." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students by class</CardTitle>
            <p className="text-xs text-muted-foreground">Enrollment across all grades</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.studentsByClass} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={tickStyle} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="value" name="Students" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gender distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Student body composition</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {genderData.map((entry, i) => (
                    <Cell key={entry.name} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fee collection</CardTitle>
            <p className="text-xs text-muted-foreground">Collected vs. due over the last 6 months</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={feeData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => formatCurrency(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="collected" name="Collected" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="due" name="Due" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {announcements.length === 0 ? (
            <EmptyState title="No announcements yet" description="Published announcements will show up here." />
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
