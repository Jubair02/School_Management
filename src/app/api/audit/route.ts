import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { handle, optionalDay, pagination, q } from "@/lib/api-utils";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit";
import type { AuditLogDTO } from "@/lib/types";

/**
 * GET /api/audit — ADMIN only.
 *
 * Read-only by design: there is deliberately no POST, PUT or DELETE here.
 * Entries are written by the endpoints that make the changes, and nothing in
 * the application can edit or remove one afterwards.
 *
 * Filters: ?action &entity &entityId &actorId &query &from &to &page &pageSize
 */
export const GET = handle(async (req: NextRequest) => {
  await requireAuth(req, ["ADMIN"]);

  const { page, pageSize, skip, take } = pagination(req);

  const action = q(req, "action");
  const entity = q(req, "entity");
  const entityId = q(req, "entityId");
  const actorId = q(req, "actorId");
  const query = q(req, "query");
  const from = optionalDay(q(req, "from"), "from");
  const to = optionalDay(q(req, "to"), "to");

  // Unknown filter values are ignored rather than rejected — a stale bookmark
  // should show the unfiltered log, not an error page.
  const where: Prisma.AuditLogWhereInput = {
    ...(action && (AUDIT_ACTIONS as readonly string[]).includes(action) ? { action } : {}),
    ...(entity && (AUDIT_ENTITIES as readonly string[]).includes(entity) ? { entity } : {}),
    ...(entityId ? { entityId } : {}),
    ...(actorId ? { actorId } : {}),
    ...(query
      ? {
          OR: [
            { summary: { contains: query, mode: "insensitive" } },
            { actorName: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            // `to` is inclusive of the whole day, so bound by the next midnight.
            ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };

  const [rows, total, actionGroups, entityGroups] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.auditLog.count({ where }),
    // Facets come from the whole table, not the filtered set, so choosing one
    // filter never empties the other dropdown.
    db.auditLog.groupBy({ by: ["action"] }),
    db.auditLog.groupBy({ by: ["entity"] }),
  ]);

  const entries: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorName: r.actorName,
    actorRole: r.actorRole,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    summary: r.summary,
    before: (r.before as Record<string, unknown> | null) ?? null,
    after: (r.after as Record<string, unknown> | null) ?? null,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({
    entries,
    total,
    page,
    pageSize,
    facets: {
      actions: actionGroups.map((g) => g.action).sort(),
      entities: entityGroups.map((g) => g.entity).sort(),
    },
  });
});
