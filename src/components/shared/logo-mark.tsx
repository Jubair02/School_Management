/**
 * EduSphere — the brand glyph: a mortarboard resting on a meridian globe
 * ("Edu" + "Sphere"). Drawn in `currentColor` so it works on the emerald
 * brand tile, in the dark theme, and as a flat mono mark.
 */
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      aria-hidden
    >
      {/* Globe: outline, equator, meridian */}
      <circle cx="12" cy="15" r="6.6" />
      <path d="M5.4 15h13.2" />
      <path d="M12 8.4c1.9 1.8 2.9 4.1 2.9 6.6s-1 4.8-2.9 6.6c-1.9-1.8-2.9-4.1-2.9-6.6s1-4.8 2.9-6.6z" />
      {/* Mortarboard sitting on top, filled so it reads at 16px */}
      <path d="M12 2.4 21.4 6.4 12 10.4 2.6 6.4z" fill="currentColor" />
      {/* Tassel */}
      <path d="M19.2 7.35v3.15" />
      <circle cx="19.2" cy="11.3" r="0.85" fill="currentColor" />
    </svg>
  );
}
