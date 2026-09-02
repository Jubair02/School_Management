"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { api } from "@/lib/client-api";
import type { AnnouncementDTO, AudienceType } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  formatDate,
  formatDateTime,
  titleCase,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const AUDIENCE_STYLES: Record<AudienceType, string> = {
  ALL: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  TEACHERS: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  STUDENTS: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  PARENTS: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  SPECIFIC_CLASS: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
};

function audienceLabel(a: AnnouncementDTO): string {
  return a.targetAudience === "SPECIFIC_CLASS" && a.class
    ? `Class ${a.class.name}`
    : titleCase(a.targetAudience);
}

/**
 * Read-only, role-filtered announcement list (server filters by the logged-in
 * role). Reused as student:announcements and parent:announcements.
 */
export function AnnouncementsView({
  subtitle = "Notices from the school, newest first",
}: {
  subtitle?: string;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: AnnouncementDTO[] }>("/api/announcements"),
  });

  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-4">
      <PageHeader title="Announcements" subtitle={subtitle} />

      {isLoading ? (
        <LoadingState variant="list" rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="School notices will appear here as soon as they are published."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {announcements.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={AUDIENCE_STYLES[a.targetAudience]}>
                    {audienceLabel(a)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.content}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  By {a.publishedBy} · {formatDateTime(a.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
