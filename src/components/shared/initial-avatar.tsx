"use client";

import { cn } from "@/lib/utils";
import { initials } from "./format";

const PALETTE = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
] as const;

/** Deterministic colored avatar with the person's initials. */
export function InitialAvatar({ name, className }: { name: string; className?: string }) {
  const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tone = PALETTE[hash % PALETTE.length];
  return (
    <div
      aria-hidden
      className={cn("flex size-9 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold", tone, className)}
    >
      {initials(name) || "?"}
    </div>
  );
}
