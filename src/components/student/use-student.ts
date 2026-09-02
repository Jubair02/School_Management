"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { StudentDashboard, StudentDetailDTO } from "@/lib/types";

/**
 * Role-aware dashboard for the logged-in STUDENT.
 * Cached under ["student", "dashboard"] and shared by several views —
 * `student.id` in the payload is the DB id used for /api/students/[id] (self).
 */
export function useStudentDashboard() {
  return useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: () => api.get<StudentDashboard>("/api/dashboard"),
  });
}

/**
 * Full self profile via GET /api/students/[id] (STUDENT self allowed).
 * Also the reliable source of `class.id` for the timetable / exams queries.
 */
export function useStudentDetail(dbId: string | undefined) {
  return useQuery({
    queryKey: ["student", "detail", dbId],
    queryFn: () => api.get<{ student: StudentDetailDTO }>(`/api/students/${dbId}`),
    enabled: Boolean(dbId),
  });
}
