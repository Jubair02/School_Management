/**
 * EduSphere — REST API utilities: error handling, Zod body validation,
 * query-param/date helpers, fee-status recompute and DTO mappers.
 * SERVER ONLY — imports Prisma; never import from client components.
 */
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { overallFor, round1, round2 } from "@/lib/grade";
import type {
  AnnouncementDTO,
  AudienceType,
  ClassDTO,
  ExamDTO,
  ExamStatus,
  FeeDTO,
  FeeStatus,
  FeeType,
  Gender,
  ParentDTO,
  PaymentMethod,
  PublicUser,
  Role,
  StudentDTO,
  SubjectDTO,
  TeacherDTO,
  TimetableEntryDTO,
  UserStatus,
  WeekDay,
} from "@/lib/types";

// ── Errors ─────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function prismaErrorShape(err: unknown): { status: number; message: string } | null {
  const code = (err as { code?: string } | null)?.code;
  if (code === "P2002") {
    const target = (err as { meta?: { target?: string[] | string } }).meta?.target ?? [];
    const fields = Array.isArray(target) ? target : [String(target)];
    if (fields.some((f) => f.includes("email")))
      return { status: 400, message: "An account with this email already exists." };
    if (fields.some((f) => f === "studentId"))
      return { status: 400, message: "This student ID is already in use." };
    if (fields.some((f) => f === "teacherId" && fields.some((g) => g === "classId")))
      return { status: 400, message: "This teacher is already assigned to this class." };
    if (fields.some((f) => f === "teacherId"))
      return { status: 400, message: "This teacher ID is already in use." };
    if (fields.some((f) => f === "studentId" && fields.some((g) => g === "date")))
      return { status: 400, message: "Attendance for this student on this date already exists." };
    return { status: 400, message: "A record with the same unique value already exists." };
  }
  if (code === "P2025") return { status: 404, message: "The requested record was not found." };
  if (code === "P2003")
    return { status: 400, message: "Related record not found — check the provided IDs." };
  return null;
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue && issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    return NextResponse.json(
      { error: `${issue?.message ?? "Invalid input"}${path}` },
      { status: 400 }
    );
  }
  const prisma = prismaErrorShape(err);
  if (prisma) return NextResponse.json({ error: prisma.message }, { status: prisma.status });
  console.error("[api] Unhandled error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** Wrap a route handler: any thrown ApiError/Zod/Prisma error becomes a JSON error response. */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>
): (...args: A) => Promise<NextResponse> {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

// ── Body validation ────────────────────────────────────────

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue && issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    throw new ApiError(400, `${issue?.message ?? "Invalid input"}${path}`);
  }
  return result.data;
}

// ── Query params (empty/missing → undefined) ───────────────

export function q(req: NextRequest, key: string): string | undefined {
  const v = req.nextUrl.searchParams.get(key);
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function qInt(req: NextRequest, key: string, fallback: number): number {
  const v = q(req, key);
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function pagination(req: NextRequest): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, qInt(req, "page", 1));
  const pageSize = Math.min(200, Math.max(1, qInt(req, "pageSize", 50)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// ── Dates ──────────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(s: string): boolean {
  return DAY_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00.000Z`).getTime());
}

export function requireDay(value: string | undefined, label = "date"): string {
  if (!value) throw new ApiError(400, `${label} is required`);
  if (!isValidDay(value)) throw new ApiError(400, `Invalid ${label} — use YYYY-MM-DD format`);
  return value;
}

export function optionalDay(value: string | undefined, label = "date"): string | undefined {
  if (value === undefined) return undefined;
  return requireDay(value, label);
}

/** Convert a YYYY-MM-DD string to a Date at UTC midnight (stable per-day bucket). */
export function dayStartUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Half-open UTC range [00:00, next 00:00) covering one calendar day. */
export function dayRangeUTC(dateStr: string): { gte: Date; lt: Date } {
  const gte = dayStartUTC(dateStr);
  const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
  return { gte, lt };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function toISO(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ── Enums (SQLite stores strings) ──────────────────────────

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export const FEE_TYPES = ["TUITION", "ADMISSION", "EXAM", "TRANSPORT", "LIBRARY", "OTHER"] as const;
export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "BANK"] as const;
export const AUDIENCES = ["ALL", "TEACHERS", "STUDENTS", "PARENTS", "SPECIFIC_CLASS"] as const;
export const EXAM_STATUSES = ["SCHEDULED", "ONGOING", "COMPLETED"] as const;
export const WEEK_DAYS = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
] as const;

/** School week ordering: Sunday → Thursday (BD), then Fri/Sat. */
export const DAY_ORDER: string[] = [...WEEK_DAYS];

export function todayDayName(): WeekDay {
  return WEEK_DAYS[new Date().getUTCDay()];
}

export function sortTimetable<T extends { day: string; period: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.period - b.period
  );
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// ── Fees ───────────────────────────────────────────────────

/** Recompute fee status: PAID if paid>=amount; PARTIAL if >0; OVERDUE if past due & unpaid; else PENDING. */
export function feeStatusFor(amount: number, paidAmount: number, dueDate: Date): FeeStatus {
  if (paidAmount >= amount) return "PAID";
  if (paidAmount > 0) return "PARTIAL";
  if (dueDate.getTime() < Date.now()) return "OVERDUE";
  return "PENDING";
}

export function outstandingOf(amount: number, paidAmount: number): number {
  return Math.max(0, amount - paidAmount);
}

// ── Auto IDs ───────────────────────────────────────────────

function nextIdFrom(prefix: string, lastId: string | null | undefined): string {
  const seq = lastId ? parseInt(lastId.slice(prefix.length), 10) + 1 : 1;
  const n = Number.isNaN(seq) ? 1 : seq;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** STU-YYYY-#### — year continues the latest existing sequence (demo data: 2025). */
export async function nextStudentCode(): Promise<string> {
  const last = await db.student.findFirst({
    orderBy: { studentId: "desc" },
    select: { studentId: true },
  });
  const year = last?.studentId.match(/^STU-(\d{4})-/)?.[1] ?? String(new Date().getFullYear());
  return nextIdFrom(`STU-${year}-`, last?.studentId.startsWith(`STU-${year}-`) ? last.studentId : null);
}

/** TCH-YYYY-#### — same rule as students. */
export async function nextTeacherCode(): Promise<string> {
  const last = await db.teacher.findFirst({
    orderBy: { teacherId: "desc" },
    select: { teacherId: true },
  });
  const year = last?.teacherId.match(/^TCH-(\d{4})-/)?.[1] ?? String(new Date().getFullYear());
  return nextIdFrom(`TCH-${year}-`, last?.teacherId.startsWith(`TCH-${year}-`) ? last.teacherId : null);
}

// ── Public user ────────────────────────────────────────────

export function toPublicUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  phone: string | null;
  status: string;
}): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    avatar: u.avatar,
    phone: u.phone,
    status: u.status as UserStatus,
  };
}

// ── Shared lookups ─────────────────────────────────────────

export async function getStudentByUserId(userId: string) {
  return db.student.findUnique({ where: { userId } });
}

export async function getTeacherByUserId(userId: string) {
  return db.teacher.findUnique({ where: { userId } });
}

export async function getParentByUserId(userId: string) {
  return db.parent.findUnique({ where: { userId } });
}

/** Class ids where the teacher teaches a subject OR is assigned class teacher. */
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  const [taught, assigned] = await Promise.all([
    db.subject.findMany({ where: { teacherId }, select: { classId: true } }),
    db.teacherClass.findMany({ where: { teacherId }, select: { classId: true } }),
  ]);
  return Array.from(new Set([...taught.map((s) => s.classId), ...assigned.map((a) => a.classId)]));
}

export function attendanceCounts(rows: { status: string }[]) {
  const total = rows.length;
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const leave = rows.filter((r) => r.status === "LEAVE").length;
  const percentage = total > 0 ? round1((present / total) * 100) : 0;
  return { total, present, absent, late, leave, percentage };
}

/** GPA across all of a student's results (grade-of-average semantics); null when no results. */
export async function computeGpaForStudent(studentId: string): Promise<number | null> {
  const rows = await db.result.findMany({ where: { studentId }, select: { marks: true } });
  if (rows.length === 0) return null;
  return overallFor(rows.map((r) => r.marks)).gpa;
}

export function pct(part: number, total: number): number {
  return total > 0 ? round1((part / total) * 100) : 0;
}

// ── DTO mappers ────────────────────────────────────────────

export const studentInclude = {
  user: true,
  class: true,
  section: true,
  parent: { include: { user: { select: { name: true } } } },
} satisfies Prisma.StudentInclude;

export type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

export function toStudentDTO(s: StudentRow): StudentDTO {
  return {
    id: s.id,
    studentId: s.studentId,
    rollNumber: s.rollNumber,
    dateOfBirth: toISO(s.dateOfBirth),
    gender: (s.gender as Gender | null) ?? null,
    address: s.address,
    admissionDate: s.admissionDate.toISOString(),
    status: s.status as UserStatus,
    user: toPublicUser(s.user),
    class: s.class ? { id: s.class.id, name: s.class.name } : null,
    section: s.section ? { id: s.section.id, name: s.section.name, classId: s.section.classId } : null,
    parent: s.parent ? { id: s.parent.id, name: s.parent.user.name } : null,
  };
}

export const teacherInclude = {
  user: true,
  subjects: { include: { class: { select: { name: true } } }, orderBy: { name: "asc" } },
  teacherClasses: { include: { class: true } },
} satisfies Prisma.TeacherInclude;

export type TeacherRow = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>;

export function toTeacherDTO(t: TeacherRow): TeacherDTO {
  return {
    id: t.id,
    teacherId: t.teacherId,
    department: t.department,
    joiningDate: t.joiningDate.toISOString(),
    status: t.status as UserStatus,
    user: toPublicUser(t.user),
    subjects: t.subjects.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      classId: s.classId,
      className: s.class.name,
    })),
    classes: t.teacherClasses.map((tc) => ({ id: tc.class.id, name: tc.class.name })),
  };
}

export const parentInclude = {
  user: true,
  students: { include: { user: true, class: true, section: true } },
} satisfies Prisma.ParentInclude;

export type ParentRow = Prisma.ParentGetPayload<{ include: typeof parentInclude }>;

export function toParentDTO(p: ParentRow): ParentDTO {
  return {
    id: p.id,
    user: toPublicUser(p.user),
    phone: p.phone,
    address: p.address,
    children: p.students.map((st) => ({
      id: st.id,
      name: st.user.name,
      studentId: st.studentId,
      className: st.class?.name ?? null,
      sectionName: st.section?.name ?? null,
    })),
  };
}

export const classInclude = {
  sections: { orderBy: { name: "asc" } },
  _count: { select: { students: { where: { status: "ACTIVE" } }, subjects: true } },
  teacherClasses: { include: { teacher: { include: { user: { select: { name: true } } } } } },
} satisfies Prisma.ClassInclude;

export type ClassRow = Prisma.ClassGetPayload<{ include: typeof classInclude }>;

export function toClassDTO(c: ClassRow): ClassDTO {
  return {
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    sections: c.sections.map((s) => ({ id: s.id, name: s.name, classId: s.classId })),
    subjectCount: c._count.subjects,
    studentCount: c._count.students,
    classTeachers: c.teacherClasses.map((tc) => ({ id: tc.teacher.id, name: tc.teacher.user.name })),
  };
}

export const subjectInclude = {
  class: true,
  teacher: { include: { user: { select: { name: true } } } },
} satisfies Prisma.SubjectInclude;

export type SubjectRow = Prisma.SubjectGetPayload<{ include: typeof subjectInclude }>;

export function toSubjectDTO(s: SubjectRow): SubjectDTO {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    classId: s.classId,
    className: s.class.name,
    teacher: s.teacher ? { id: s.teacher.id, name: s.teacher.user.name } : null,
  };
}

export const examInclude = {
  class: true,
  _count: { select: { results: true } },
} satisfies Prisma.ExamInclude;

export type ExamRow = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

export function toExamDTO(e: ExamRow): ExamDTO {
  return {
    id: e.id,
    name: e.name,
    classId: e.classId,
    className: e.class.name,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    status: e.status as ExamStatus,
    resultCount: e._count.results,
  };
}

export const feeInclude = {
  student: { include: { user: { select: { name: true } } } },
  payments: { orderBy: { paidAt: "desc" } },
} satisfies Prisma.FeeInclude;

export type FeeRow = Prisma.FeeGetPayload<{ include: typeof feeInclude }>;

export function toFeeDTO(f: FeeRow, statusOverride?: FeeStatus): FeeDTO {
  return {
    id: f.id,
    studentId: f.studentId,
    studentName: f.student.user.name,
    studentCode: f.student.studentId,
    title: f.title,
    type: f.type as FeeType,
    amount: f.amount,
    paidAmount: f.paidAmount,
    dueDate: f.dueDate.toISOString(),
    status: statusOverride ?? feeStatusFor(f.amount, f.paidAmount, f.dueDate),
    payments: f.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method as PaymentMethod,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
    })),
  };
}

export const announcementInclude = {
  class: true,
  publishedBy: { select: { name: true } },
} satisfies Prisma.AnnouncementInclude;

export type AnnouncementRow = Prisma.AnnouncementGetPayload<{ include: typeof announcementInclude }>;

export function toAnnouncementDTO(a: AnnouncementRow): AnnouncementDTO {
  return {
    id: a.id,
    title: a.title,
    content: a.content,
    targetAudience: a.targetAudience as AudienceType,
    class: a.class ? { id: a.class.id, name: a.class.name } : null,
    publishedBy: a.publishedBy.name,
    createdAt: a.createdAt.toISOString(),
  };
}

export const timetableInclude = {
  class: true,
  subject: true,
  teacher: { include: { user: { select: { name: true } } } },
} satisfies Prisma.TimetableInclude;

export type TimetableRow = Prisma.TimetableGetPayload<{ include: typeof timetableInclude }>;

export function toTimetableDTO(t: TimetableRow): TimetableEntryDTO {
  return {
    id: t.id,
    classId: t.classId,
    className: t.class.name,
    day: t.day as WeekDay,
    period: t.period,
    startTime: t.startTime,
    endTime: t.endTime,
    subject: t.subject ? { id: t.subject.id, name: t.subject.name } : null,
    teacher: t.teacher ? { id: t.teacher.id, name: t.teacher.user.name } : null,
  };
}

// ── Announcement visibility ────────────────────────────────

export function announcementWhereFor(
  role: Role,
  ids: {
    studentClassId?: string | null;
    teacherClassIds?: string[];
    childrenClassIds?: string[];
  }
): Prisma.AnnouncementWhereInput {
  switch (role) {
    case "ADMIN":
      return {};
    case "TEACHER":
      return {
        OR: [
          { targetAudience: "ALL" },
          { targetAudience: "TEACHERS" },
          { targetAudience: "SPECIFIC_CLASS", classId: { in: ids.teacherClassIds ?? [] } },
        ],
      };
    case "STUDENT":
      return {
        OR: [
          { targetAudience: "ALL" },
          { targetAudience: "STUDENTS" },
          { targetAudience: "SPECIFIC_CLASS", classId: { in: ids.studentClassId ? [ids.studentClassId] : [] } },
        ],
      };
    case "PARENT":
      return {
        OR: [
          { targetAudience: "ALL" },
          { targetAudience: "PARENTS" },
          { targetAudience: "SPECIFIC_CLASS", classId: { in: ids.childrenClassIds ?? [] } },
        ],
      };
  }
}
