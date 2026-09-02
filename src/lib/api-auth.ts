import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { ApiError, toPublicUser } from "@/lib/api-utils";
import type { PublicUser, Role } from "@/lib/types";

/**
 * Authenticate the request via the sms_token cookie.
 * Optionally enforce allowed roles. Throws ApiError (401/403) on failure.
 * The returned user is re-fetched from DB so role/status changes take effect.
 */
export async function requireAuth(req: NextRequest, roles?: Role[]): Promise<PublicUser> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) throw new ApiError(401, "Not authenticated. Please log in.");

  const payload = await verifyToken(token);
  if (!payload?.sub) throw new ApiError(401, "Session is invalid or has expired. Please log in again.");

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new ApiError(401, "Session user no longer exists. Please log in again.");
  if (user.status === "INACTIVE")
    throw new ApiError(403, "This account has been deactivated. Please contact the school office.");

  if (roles && roles.length > 0 && !roles.includes(user.role as Role)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  return toPublicUser(user);
}
