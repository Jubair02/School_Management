"use client";

import { GraduationCap } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/layout/app-shell";

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative">
        <div className="absolute inset-0 -m-3 animate-ping rounded-2xl bg-emerald-500/20" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg">
          <GraduationCap className="size-9" aria-hidden />
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-bold tracking-tight">EduSphere</p>
        <p className="text-xs text-muted-foreground">School Management System</p>
      </div>
      <div className="mt-2 size-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-label="Loading" />
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <LoginScreen />;
  return <AppShell />;
}

export default function Page() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
