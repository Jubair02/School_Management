"use client";

import type { ComponentType } from "react";
import { AdminDashboardView } from "./dashboard";
import { StudentsView } from "./students";
import { TeachersView } from "./teachers";
import { ParentsView } from "./parents";
import { ClassesView } from "./classes";
import { SubjectsView } from "./subjects";
import { TimetableAdminView } from "./timetable";
import { ExamsView } from "./exams";
import { FeesView } from "./fees";
import { AnnouncementsView } from "./announcements";
import { AuditLogView } from "./audit-log";

/**
 * Admin view registry — keys match src/components/nav/nav-admin.ts.
 * AppShell looks up the active view here by nav key.
 */
export const adminViews: Record<string, ComponentType> = {
  "admin:dashboard": AdminDashboardView,
  "admin:students": StudentsView,
  "admin:teachers": TeachersView,
  "admin:parents": ParentsView,
  "admin:classes": ClassesView,
  "admin:subjects": SubjectsView,
  "admin:timetable": TimetableAdminView,
  "admin:exams": ExamsView,
  "admin:fees": FeesView,
  "admin:announcements": AnnouncementsView,
  "admin:audit": AuditLogView,
};
