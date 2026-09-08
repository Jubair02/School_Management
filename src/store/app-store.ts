"use client";

import { create } from "zustand";

/**
 * Global UI state. `activeView` is the nav key of the currently
 * rendered view (e.g. "admin:students") — consumed by AppShell.
 */
interface AppState {
  activeView: string | null;
  setActiveView: (view: string) => void;
  /** Read a preselect once and clear it, so it cannot leak into a later visit. */
  takePreselect: (key: PreselectKey) => string | null;
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

export type PreselectKey = "attendancePreselect" | "marksPreselect" | "classesPreselect";

/**
 * The active view is mirrored into `location.hash`.
 *
 * The app serves everything from `/`, so without this a refresh always dropped
 * the user back on the dashboard, Back exited the app entirely, and no screen
 * could be linked to. The hash keeps those working without splitting the SPA
 * into separate Next routes.
 *
 * Nav keys look like "admin:students"; ":" is escaped in a hash by some
 * clients, so it travels as "admin/students".
 */
export function viewToHash(view: string): string {
  return view.replace(":", "/");
}

export function hashToView(hash: string): string | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const view = raw.replace("/", ":");
  return /^[a-z]+:[a-z-]+$/.test(view) ? view : null;
}

/** The view named by the current URL hash, or null. Safe during SSR. */
export function viewFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return hashToView(window.location.hash);
}

export const useAppStore = create<AppState>((set, get) => ({
  // Seeded from the URL so a deep link or refresh lands on the right screen.
  activeView: viewFromLocation(),
  setActiveView: (activeView) => set({ activeView }),
  attendancePreselect: null,
  marksPreselect: null,
  classesPreselect: null,
  takePreselect: (key) => {
    const value = get()[key];
    if (value !== null) set({ [key]: null } as Pick<AppState, PreselectKey>);
    return value;
  },
}));
