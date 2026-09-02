/** Small helpers shared by the teacher views. */

/** Shape of GET /api/teachers/me/classes items. */
export interface MyClass {
  id: string;
  name: string;
  studentCount: number;
  subjectCount: number;
}

/** "09:40" → "9:40 AM" (falls back to the raw value). */
export function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = Number(hStr);
  if (Number.isNaN(h)) return t;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m ?? "00"} ${suffix}`;
}

/**
 * Formats a date for display. Pure "YYYY-MM-DD" strings (attendance dates,
 * date input values) are parsed as LOCAL dates to avoid timezone drift;
 * full ISO timestamps go through unchanged.
 */
export function formatDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Today's date as "YYYY-MM-DD" (UTC) — matches the backend's UTC day normalization. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Soft audience-badge styles for announcement cards (same palette as admin). */
export const AUDIENCE_STYLES: Record<string, string> = {
  ALL: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  TEACHERS: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  STUDENTS: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  PARENTS: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  SPECIFIC_CLASS: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
};
