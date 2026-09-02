"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { api } from "@/lib/client-api";
import type { AnnouncementDTO } from "@/lib/types";
import {
  EmptyState,
  LoadingState,
  LoadError,
  PageHeader,
  formatDate,
  titleCase,
} from "@/components/shared";
import { AUDIENCE_STYLES } from "./common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function audienceLabel(a: AnnouncementDTO): string {
  return a.targetAudience === "SPECIFIC_CLASS" && a.class
    ? `Class ${a.class.name}`
    : titleCase(a.targetAudience);
}

export function TeacherAnnouncementsView() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: AnnouncementDTO[] }>("/api/announcements"),
  });

  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        subtitle="School-wide notices and updates addressed to you or your classes"
      />

      {isLoading ? (
        <LoadingState variant="list" rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Notices published by the school office will appear here."
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
                <p className="text-xs text-muted-foreground">By {a.publishedBy}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
