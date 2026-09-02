import type { NavItem } from "@/lib/types";

/**
 * Admin navigation — keys map to `adminViews` in src/components/admin/index.tsx.
 * Icon names are resolved to lucide-react icons by AppShell.
 */
export const adminNav: NavItem[] = [
  { key: "admin:dashboard", label: "Dashboard", icon: "BarChart3" },
  { key: "admin:students", label: "Students", icon: "GraduationCap" },
  { key: "admin:teachers", label: "Teachers", icon: "Briefcase" },
  { key: "admin:parents", label: "Parents", icon: "Users" },
  { key: "admin:classes", label: "Classes", icon: "School" },
  { key: "admin:subjects", label: "Subjects", icon: "BookOpen" },
  { key: "admin:timetable", label: "Timetable", icon: "CalendarClock" },
  { key: "admin:exams", label: "Exams", icon: "FileText" },
  { key: "admin:fees", label: "Fees", icon: "Wallet" },
  { key: "admin:announcements", label: "Announcements", icon: "Megaphone" },
];
