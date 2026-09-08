import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EduSphere serves everything from `/`, so any other path is a mistyped or
 * stale URL. Without this the visitor gets Next's bare default 404.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
        <GraduationCap className="size-7" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          That address doesn&apos;t exist. Everything in EduSphere lives on the main portal.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Go to the portal</Link>
      </Button>
    </div>
  );
}
