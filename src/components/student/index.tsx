"use client";

import type { ComponentType } from "react";
import { StudentDashboardView } from "./student-dashboard";
import { StudentAttendanceView } from "./attendance-view";
import { StudentResultsView } from "./results-view";
import { StudentFeesView } from "./fees-view";
import { StudentTimetableView } from "./timetable-view";
import { AnnouncementsView } from "./announcements-view";
import { StudentProfileView } from "./student-profile";

/**
 * Student view registry — keys match src/components/nav/nav-student.ts.
 * AppShell looks up the active view here by nav key.
 */
export const studentViews: Record<string, ComponentType> = {
  "student:dashboard": StudentDashboardView,
  "student:attendance": StudentAttendanceView,
  "student:results": StudentResultsView,
  "student:fees": StudentFeesView,
  "student:timetable": StudentTimetableView,
  "student:announcements": AnnouncementsView,
  "student:profile": StudentProfileView,
};
