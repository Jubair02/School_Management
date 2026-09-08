"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type {
  AnnouncementDTO,
  AudienceType,
  ClassDTO,
} from "@/lib/types";
import {
  ConfirmDialog,
  EmptyState,
  FormDialog,
  LoadingState,
  LoadError,
  PageHeader,
  formatDate,
  formatDateTime,
  titleCase,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AUDIENCES: { value: AudienceType; label: string }[] = [
  { value: "ALL", label: "Everyone" },
  { value: "TEACHERS", label: "Teachers" },
  { value: "STUDENTS", label: "Students" },
  { value: "PARENTS", label: "Parents" },
  { value: "SPECIFIC_CLASS", label: "Specific class" },
];

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
    : (AUDIENCES.find((x) => x.value === a.targetAudience)?.label ?? titleCase(a.targetAudience));
}

/** Compose a new announcement, or edit an existing one when `editing` is set. */
function ComposeDialog({
  editing,
  onOpenChange,
}: {
  editing?: AnnouncementDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [audience, setAudience] = useState<AudienceType>(editing?.targetAudience ?? "ALL");
  const [classId, setClassId] = useState(editing?.class?.id ?? "");

  // Mounted only while composing — state initializers give a fresh form each time.
  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<{ classes: ClassDTO[] }>("/api/classes"),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        targetAudience: audience,
        // Sent as null on edit so switching away from SPECIFIC_CLASS actually
        // detaches the class rather than leaving the old one attached.
        classId: audience === "SPECIFIC_CLASS" ? classId : editing ? null : undefined,
      };
      return editing
        ? api.put(`/api/announcements/${editing.id}`, payload)
        : api.post("/api/announcements", payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Announcement updated" : "Announcement published");
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const valid = title.trim() && content.trim() && (audience !== "SPECIFIC_CLASS" || classId);

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={editing ? "Edit announcement" : "New announcement"}
      description={
        editing
          ? "Changes appear immediately on every dashboard showing this notice."
          : "Published instantly to the selected audience."
      }
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) {
          toast.error("Enter a title, content and pick the audience");
          return;
        }
        mutation.mutate();
      }}
      submitting={mutation.isPending}
      submitLabel={editing ? "Save changes" : "Publish"}
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ann-title">Title *</Label>
          <Input
            id="ann-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Parent–teacher meeting on Friday"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ann-content">Content *</Label>
          <Textarea
            id="ann-content"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the announcement…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as AudienceType)}>
              <SelectTrigger className="w-full" aria-label="Audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {audience === "SPECIFIC_CLASS" ? (
            <div className="grid gap-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full" aria-label="Target class">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {(classesData?.classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </FormDialog>
  );
}

export function AnnouncementsView() {
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementDTO | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementDTO | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ announcements: AnnouncementDTO[] }>("/api/announcements"),
  });

  const deleteMutation = useMutation({
    mutationFn: (a: AnnouncementDTO) => api.del(`/api/announcements/${a.id}`),
    onSuccess: () => {
      toast.success("Announcement deleted");
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        subtitle="Notices broadcast to teachers, students, parents or a single class"
        actions={
          <Button onClick={() => setComposeOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Compose
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState variant="list" rows={4} />
      ) : error ? (
        <LoadError message={(error as Error).message} onRetry={() => void refetch()} />
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          description="Compose the first announcement — it shows up on every relevant dashboard instantly."
          action={
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Compose
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {announcements.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline" className={AUDIENCE_STYLES[a.targetAudience]}>
                      {audienceLabel(a)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${a.title}`}
                      onClick={() => setEditing(a)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                      aria-label={`Delete ${a.title}`}
                      onClick={() => setDeleting(a)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{a.content}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  By {a.publishedBy} · {formatDateTime(a.createdAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {composeOpen ? <ComposeDialog onOpenChange={setComposeOpen} /> : null}
      {editing ? (
        <ComposeDialog editing={editing} onOpenChange={(open) => !open && setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete announcement?"
        description={`"${deleting?.title ?? ""}" will be removed from all dashboards.`}
        confirmLabel="Delete"
        onConfirm={() => (deleting ? deleteMutation.mutateAsync(deleting) : Promise.resolve())}
      />
    </div>
  );
}
