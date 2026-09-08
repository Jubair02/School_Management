"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  /** Label of the view being wrapped, used in the message. */
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * Error boundary around a single role view.
 *
 * The route-level `error.tsx` replaces the entire screen, sidebar included, so
 * a crash in one view would strand the user with no navigation. This keeps the
 * shell alive: the failure is contained to the content area and every other
 * view stays reachable.
 *
 * Must be a class component — React has no hook equivalent for
 * componentDidCatch.
 */
export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[edusphere] View crashed:", error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex items-center justify-center py-10">
        <Card className="w-full max-w-md border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
              <TriangleAlert className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-base font-semibold">
                {this.props.title ? `${this.props.title} could not be displayed` : "This view could not be displayed"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Something went wrong while rendering this screen. You can retry, or pick another
                item from the menu.
              </p>
            </div>
            <Button size="sm" onClick={this.retry}>
              <RefreshCw className="size-4" aria-hidden />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
