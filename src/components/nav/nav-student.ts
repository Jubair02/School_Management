import type { NavItem } from "@/lib/types";

/**
 * Student navigation — keys map to `studentViews` in src/components/student/index.tsx
 * (Task 3-b replaces that bundle with real views using these exact keys).
 */
export const studentNav: NavItem[] = [
  { key: "student:dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "student:attendance", label: "My Attendance", icon: "ClipboardCheck" },
  { key: "student:results", label: "My Results", icon: "Award" },
  { key: "student:fees", label: "My Fees", icon: "Wallet" },
  { key: "student:timetable", label: "My Timetable", icon: "CalendarDays" },
  { key: "student:announcements", label: "Announcements", icon: "Megaphone" },
  { key: "student:profile", label: "My Profile", icon: "UserRound" },
];
