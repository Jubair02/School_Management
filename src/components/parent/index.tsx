"use client";

import type { ComponentType } from "react";
import { ParentDashboardView } from "./parent-dashboard";
import { ParentChildrenView } from "./children-view";
import { ParentResultsView } from "./results-view";
import { ParentFeesView } from "./fees-view";
import { ParentAnnouncementsView } from "./announcements-view";

/**
 * Parent view registry — keys match src/components/nav/nav-parent.ts.
 * AppShell looks up the active view here by nav key.
 */
export const parentViews: Record<string, ComponentType> = {
  "parent:dashboard": ParentDashboardView,
  "parent:children": ParentChildrenView,
  "parent:results": ParentResultsView,
  "parent:fees": ParentFeesView,
  "parent:announcements": ParentAnnouncementsView,
};
