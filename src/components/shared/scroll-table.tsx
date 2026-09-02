"use client";

import { cn } from "@/lib/utils";

/** Scrollable wrapper for long tables/lists — max height + horizontal scroll on mobile. */
export function ScrollTable({
  children,
  className,
  maxHeight = "max-h-[520px]",
}: {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div className={cn("scrollbar-thin overflow-auto rounded-lg border bg-card", maxHeight, className)}>
      {children}
    </div>
  );
}
