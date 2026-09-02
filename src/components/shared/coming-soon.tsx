"use client";

import { Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Elegant placeholder for role areas that ship in the next phase. */
export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-10">
      <Card className="w-full max-w-md border-dashed bg-gradient-to-b from-emerald-50/60 to-transparent dark:from-emerald-500/5">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
            <Sparkles className="size-7" aria-hidden />
          </div>
          <div>
            <p className="text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This area is part of the next phase of EduSphere and will light up soon.
            </p>
          </div>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Clock className="size-3" aria-hidden />
            Coming in the next phase
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
