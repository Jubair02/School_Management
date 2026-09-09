/**
 * EduSphere — audit trail recording.
 * SERVER ONLY — imports Prisma; never import from client components.
 *
 * Governance for the two things a school will argue about: grades and money.
 * Every mutating endpoint records who did what, with the changed fields only.
 */
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/rate-limit";
import type { PublicUser } from "@/lib/types";

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "PAYMENT",
  "GRADE",
  "ATTENDANCE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "PASSWORD_RESET",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITIES = [
  "Student",
  "Teacher",
  "Parent",
  "Class",
  "Section",
  "Subject",
  "Exam",
  "Result",
  "Attendance",
  "Fee",
  "Payment",
  "Announcement",
  "Timetable",
  "Auth",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

type Payload = Record<string, unknown> | null;

interface RecordInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  summary: string;
  before?: Payload;
  after?: Payload;
}

/** Actor identity, either a signed-in user or an anonymous request. */
interface Actor {
  id: string | null;
  name: string;
  role: string;
}

export function actorOf(user: PublicUser): Actor {
  return { id: user.id, name: user.name, role: user.role };
}

/** For endpoints that run before (or without) authentication, e.g. login. */
export function anonymousActor(label = "Anonymous"): Actor {
  return { id: null, name: label, role: "ANONYMOUS" };
}

/**
 * Append one entry.
 *
 * Written after the business transaction commits, and never allowed to fail the
 * request: a school losing an attendance save because the log was unreachable
 * would be worse than a gap in the log. The trade-off is that a crash between
 * the two writes leaves the action unlogged — acceptable here, but the reason
 * this is `console.error`-loud rather than silent. Moving the insert inside each
 * business transaction would close that window at the cost of tying every write
 * to the log's availability.
 */
export async function recordAudit(
  req: NextRequest,
  actor: Actor,
  input: RecordInput
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        ip: clientIp(req),
      },
    });
  } catch (err) {
    console.error("[audit] Failed to record entry:", input.summary, err);
  }
}

/** Fields that must never be copied into an audit payload. */
const REDACTED = new Set(["password", "currentPassword", "newPassword", "token"]);

/**
 * Changed fields only, as `{ before, after }`.
 *
 * Keeping just the delta matters for both size and readability — a full row
 * snapshot on every edit makes the log unreadable and the table enormous.
 * Returns nulls when nothing actually changed so callers can skip logging.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { before: Payload; after: Payload; changed: string[] } {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const changed: string[] = [];

  for (const key of Object.keys(after)) {
    if (REDACTED.has(key)) {
      // Record that it changed, never what it changed to.
      if (after[key] !== undefined) {
        changed.push(key);
        changedBefore[key] = "[redacted]";
        changedAfter[key] = "[redacted]";
      }
      continue;
    }
    if (after[key] === undefined) continue;

    const a = normalise(before[key]);
    const b = normalise(after[key]);
    if (a !== b) {
      changed.push(key);
      changedBefore[key] = before[key] ?? null;
      changedAfter[key] = after[key];
    }
  }

  if (changed.length === 0) return { before: null, after: null, changed };
  return { before: changedBefore, after: changedAfter, changed };
}

/** Compare by value, tolerating Date and Prisma.Decimal on either side. */
function normalise(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "toString" in v) return String(v);
  return String(v);
}

/** Strip redacted keys from a payload destined for the log. */
export function safePayload(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    out[key] = REDACTED.has(key) ? "[redacted]" : value;
  }
  return out;
}
