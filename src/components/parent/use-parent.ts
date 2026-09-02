"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client-api";
import type { ParentDashboard } from "@/lib/types";

/**
 * Role-aware dashboard for the logged-in PARENT — children overview +
 * announcements. Cached under ["parent", "dashboard"] and shared by the
 * children/results/fees views (child.student.id is the DB id).
 */
export function useParentDashboard() {
  return useQuery({
    queryKey: ["parent", "dashboard"],
    queryFn: () => api.get<ParentDashboard>("/api/dashboard"),
  });
}
