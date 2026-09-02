import type { NavItem } from "@/lib/types";

/**
 * Parent navigation — keys map to `parentViews` in src/components/parent/index.tsx
 * (Task 3-b replaces that bundle with real views using these exact keys).
 */
export const parentNav: NavItem[] = [
  { key: "parent:dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { key: "parent:children", label: "My Children", icon: "UsersRound" },
  { key: "parent:results", label: "Results", icon: "Award" },
  { key: "parent:fees", label: "Fees", icon: "Wallet" },
  { key: "parent:announcements", label: "Announcements", icon: "Megaphone" },
];
