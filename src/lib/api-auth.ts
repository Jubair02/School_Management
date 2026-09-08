import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { ApiError, getTeacherByUserId, getTeacherClassIds, toPublicUser } from "@/lib/api-utils";
import type { PublicUser, Role } from "@/lib/types";

/**
 * Extract the session JWT from the `sms_token` httpOnly cookie.
 *
 * The cookie is the only accepted session carrier. An `Authorization: Bearer`
 * path used to exist for cross-site preview iframes; it was removed so that a
 * session can never be replayed from a token held in client-readable storage,
 * and so SameSite=Lax remains a meaningful CSRF defence.
 */
function extractToken(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

/**
 * Authenticate the request via the sms_token cookie.
 * Optionally enforce allowed roles. Throws ApiError (401/403) on failure.
 * The returned user is re-fetched from DB so role/status changes take effect.
 */
export async function requireAuth(req: NextRequest, roles?: Role[]): Promise<PublicUser> {
  const token = extractToken(req);
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

/* ── Object-level authorization ─────────────────────────────────────────
 * requireAuth answers "what role is this?". The helpers below answer
 * "may this particular teacher touch this particular class/student?" —
 * without them a teacher passes the role check and can then read or write
 * any class in the school by supplying someone else's classId.
 * ───────────────────────────────────────────────────────────────────────*/

/**
 * The classes a teacher may act on: those they teach a subject in, plus those
 * they are class teacher for. This is the same set `/api/teachers/me/classes`
 * feeds to the UI dropdowns, so the API accepts exactly what the UI offers.
 */
export async function teacherClassIdsFor(userId: string): Promise<string[]> {
  const teacher = await getTeacherByUserId(userId);
  if (!teacher) throw new ApiError(404, "Teacher profile not found");
  return getTeacherClassIds(teacher.id);
}

/**
 * Authorize an action against one class. ADMIN may act on any class; TEACHER
 * only on their own. Any other role is rejected outright — callers are already
 * behind a role check, this is the second gate.
 */
export async function requireClassAccess(auth: PublicUser, classId: string): Promise<void> {
  if (auth.role === "ADMIN") return;
  if (auth.role !== "TEACHER") {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const classIds = await teacherClassIdsFor(auth.id);
  if (!classIds.includes(classId)) {
    throw new ApiError(403, "You do not teach this class.");
  }
}

/**
 * Authorize an action against one student, by way of the class they are in.
 * ADMIN: any student. TEACHER: only students in a class they teach. A student
 * with no class assigned is visible to admins only.
 */
export async function requireStudentAccess(auth: PublicUser, studentId: string): Promise<void> {
  if (auth.role === "ADMIN") return;
  if (auth.role !== "TEACHER") {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });
  if (!student) throw new ApiError(404, "Student not found");

  const classIds = await teacherClassIdsFor(auth.id);
  if (!student.classId || !classIds.includes(student.classId)) {
    throw new ApiError(403, "This student is not in a class you teach.");
  }
}
