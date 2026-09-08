"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown by the root layout itself, where
 * `error.tsx` cannot help. It replaces the whole document, so it must render
 * its own <html>/<body> and cannot rely on the app's providers, fonts or
 * Tailwind layer — hence the inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[edusphere] Fatal error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          background: "#fafaf9",
          color: "#1c1917",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>EduSphere could not start</h1>
        <p style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#57534e", margin: 0 }}>
          A fatal error stopped the application from loading. Please try again, and contact the
          school office if the problem continues.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.6875rem", color: "#78716c", fontFamily: "ui-monospace, monospace" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "none",
            background: "#047857",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
