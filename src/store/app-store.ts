"use client";

import { create } from "zustand";

/**
 * Global UI state. `activeView` is the nav key of the currently
 * rendered view (e.g. "admin:students") — consumed by AppShell.
 */
interface AppState {
  activeView: string | null;
  setActiveView: (view: string) => void;
  /**
   * Teacher-view hand-off (Task 3-a): class ids preselected by a quick action
   * ("Take attendance" / "Enter marks" / class "Details") right before the
   * active view switches. Target views read them once as initial state via
   * `useAppStore.getState()` — the latest quick action overwrites the value.
   */
  attendancePreselect: string | null;
  marksPreselect: string | null;
  classesPreselect: string | null;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: null,
  setActiveView: (activeView) => set({ activeView }),
  attendancePreselect: null,
  marksPreselect: null,
  classesPreselect: null,
}));
