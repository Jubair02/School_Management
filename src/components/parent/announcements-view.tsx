"use client";

import { AnnouncementsView } from "@/components/student/announcements-view";

/**
 * parent:announcements — the API already role-filters /api/announcements
 * for the logged-in PARENT (ALL + PARENTS + children's classes).
 */
export function ParentAnnouncementsView() {
  return <AnnouncementsView subtitle="Notices from the school for parents and guardians" />;
}
