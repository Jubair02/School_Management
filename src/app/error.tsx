"use client";

import { useEffect } from "react";
import { GraduationCap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary. Without this, an uncaught render error anywhere
 * in the (single, fully client-rendered) page leaves the user on a blank white
 * screen with no way back but a manual refresh.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[edusphere] Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
        <GraduationCap className="size-7" aria-hidden />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          EduSphere hit an unexpected error while rendering this page. Your data is safe — trying
          again usually clears it.
        </p>
        {error.digest ? (
          <p className="pt-1 font-mono text-[11px] text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload the app
        </Button>
      </div>
    </div>
  );
}
