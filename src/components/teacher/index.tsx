"use client";

import type { ComponentType } from "react";
import { TeacherDashboardView } from "./dashboard";
import { TeacherClassesView } from "./classes";
import { TeacherAttendanceView } from "./attendance";
import { TeacherMarksView } from "./marks";
import { TeacherTimetableView } from "./timetable";
import { TeacherAnnouncementsView } from "./announcements";

/**
 * Teacher view registry — keys match src/components/nav/nav-teacher.ts.
 * AppShell looks up the active view here by nav key.
 */
export const teacherViews: Record<string, ComponentType> = {
  "teacher:dashboard": TeacherDashboardView,
  "teacher:classes": TeacherClassesView,
  "teacher:attendance": TeacherAttendanceView,
  "teacher:marks": TeacherMarksView,
  "teacher:timetable": TeacherTimetableView,
  "teacher:announcements": TeacherAnnouncementsView,
};
