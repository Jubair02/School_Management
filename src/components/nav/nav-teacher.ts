import type { NavItem } from "@/lib/types";

/**
 * Teacher navigation — keys map to `teacherViews` in src/components/teacher/index.tsx
 * (Task 3-a replaces that bundle with real views using these exact keys).
 */
export const teacherNav: NavItem[] = [
  { key: "teacher:dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "teacher:classes", label: "My Classes", icon: "Users" },
  { key: "teacher:attendance", label: "Attendance", icon: "ClipboardCheck" },
  { key: "teacher:marks", label: "Marks", icon: "PenLine" },
  { key: "teacher:timetable", label: "Timetable", icon: "CalendarDays" },
  { key: "teacher:announcements", label: "Announcements", icon: "Megaphone" },
];
