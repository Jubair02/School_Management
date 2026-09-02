"use client";

import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  PenLine,
  School,
  Sun,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/app-store";
import type { NavItem, Role } from "@/lib/types";
import { adminNav } from "@/components/nav/nav-admin";
import { teacherNav } from "@/components/nav/nav-teacher";
import { studentNav } from "@/components/nav/nav-student";
import { parentNav } from "@/components/nav/nav-parent";
import { adminViews } from "@/components/admin";
import { teacherViews } from "@/components/teacher";
import { studentViews } from "@/components/student";
import { parentViews } from "@/components/parent";
import { ComingSoon } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// lucide icon resolution from the string name stored in nav files
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  BarChart3,
  GraduationCap,
  Briefcase,
  UserCog,
  Users,
  UsersRound,
  UserRound,
  School,
  BookOpen,
  CalendarClock,
  CalendarDays,
  FileText,
  ClipboardList,
  ClipboardCheck,
  PenLine,
  Award,
  Wallet,
  Megaphone,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? LayoutDashboard;
}

const NAVS: Record<Role, NavItem[]> = {
  ADMIN: adminNav,
  TEACHER: teacherNav,
  STUDENT: studentNav,
  PARENT: parentNav,
};

const VIEWS: Record<Role, Record<string, ComponentType>> = {
  ADMIN: adminViews,
  TEACHER: teacherViews,
  STUDENT: studentViews,
  PARENT: parentViews,
};

const ROLE_BADGES: Record<Role, string> = {
  ADMIN: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  TEACHER: "border-transparent bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  STUDENT: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  PARENT: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm",
          compact ? "size-8" : "size-9"
        )}
      >
        <GraduationCap className={compact ? "size-4.5" : "size-5"} aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">EduSphere</p>
        {!compact ? <p className="text-[10px] text-muted-foreground">School Management</p> : null}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  // The icon swaps via the .dark class next-themes sets on <html> — no mounted state needed.
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-4.5 dark:hidden" aria-hidden />
      <Moon className="hidden size-4.5 dark:block" aria-hidden />
    </Button>
  );
}

function NavList({ items, activeKey, onSelect }: { items: NavItem[]; activeKey: string; onSelect: (key: string) => void }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
      {items.map((item) => {
        const Icon = iconFor(item.icon);
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ComingSoonView({ title }: { title: string }) {
  return <ComingSoon title={title} />;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role: Role = user?.role ?? "STUDENT";
  const items = NAVS[role];
  const views = VIEWS[role];

  const current = items.find((item) => item.key === activeView) ?? items[0];

  // Keep the active view valid for the current role (also sets the default)
  useEffect(() => {
    if (!items.some((item) => item.key === activeView)) {
      setActiveView(items[0].key);
    }
  }, [activeView, items, setActiveView]);

  function selectView(key: string) {
    setActiveView(key);
    setMobileOpen(false);
  }

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      toast.error("Could not sign out");
    }
  }

  const ActiveView: ComponentType | undefined = views[current.key];

  const roleBadge = ROLE_BADGES[role];

  return (
    <div className="flex min-h-screen w-full">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Brand />
        </div>
        <NavList items={items} activeKey={current.key} onSelect={selectView} />
        <div className="border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </aside>

      {/* ── Content column (header / main / footer) ─────── */}
      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" aria-hidden />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{current.label}</h1>
          </div>

          <Badge variant="outline" className={cn("hidden sm:inline-flex", roleBadge)}>
            {ROLE_LABELS[role]}
          </Badge>
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open user menu"
                className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                {user?.name
                  ?.split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()} className="text-destructive focus:text-destructive">
                <LogOut className="size-4" aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {ActiveView ? <ActiveView /> : <ComingSoonView title={current.label} />}
          </motion.div>
        </main>

        <footer className="mt-auto border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
          © EduSphere SMS — Admin · Teacher · Student · Parent portal
        </footer>
      </div>

      {/* ── Mobile sidebar (Sheet) ──────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="h-16 justify-center border-b border-sidebar-border px-5">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
          </SheetHeader>
          <NavList items={items} activeKey={current.key} onSelect={selectView} />
          <div className="border-t border-sidebar-border p-4">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
