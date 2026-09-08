import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import {
  ApiError,
  attendanceCounts,
  computeGpaForStudent,
  dayRangeUTC,
  examInclude,
  getTeacherClassIds,
  getStudentByUserId,
  announcementWhereFor,
  outstandingOf,
  pct,
  sortTimetable,
  timetableInclude,
  toAnnouncementDTO,
  toExamDTO,
  toMoney,
  toTimetableDTO,
  todayDayName,
  todayISO,
  naturalCompare,
  handle,
} from "@/lib/api-utils";
import { overallFor, round2 } from "@/lib/grade";

/**
 * GET /api/dashboard — single role-aware endpoint.
 * Returns AdminDashboard | TeacherDashboard | StudentDashboard | ParentDashboard per src/lib/types.ts.
 */
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireAuth(req);

  switch (auth.role) {
    case "ADMIN":
      return NextResponse.json(await adminDashboard());
    case "TEACHER":
      return NextResponse.json(await teacherDashboard(auth.id));
    case "STUDENT":
      return NextResponse.json(await studentDashboard(auth.id));
    case "PARENT":
      return NextResponse.json(await parentDashboard(auth.id));
    default:
      return NextResponse.json({ error: "Unknown role" }, { status: 403 });
  }
});

// ── ADMIN ──────────────────────────────────────────────────

async function adminDashboard() {
  const today = todayISO();
  const range = dayRangeUTC(today);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);
  sixMonthsAgo.setUTCDate(1);
  sixMonthsAgo.setUTCHours(0, 0, 0, 0);

  const [
    students,
    teachers,
    classes,
    todayRecords,
    unpaidFees,
    genderGroups,
    classChart,
    trendRecords,
    recentPayments,
    upcomingFeeDues,
    announcements,
  ] = await Promise.all([
    db.student.count({ where: { status: "ACTIVE" } }),
    db.teacher.count({ where: { status: "ACTIVE" } }),
    db.class.count(),
    db.attendance.findMany({ where: { date: range }, select: { status: true } }),
    db.fee.findMany({ where: { status: { not: "PAID" } }, select: { amount: true, paidAmount: true } }),
    db.student.groupBy({
      by: ["gender"],
      where: { status: "ACTIVE", gender: { not: null } },
      _count: true,
    }),
    db.class.findMany({
      select: { name: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
    }),
    db.attendance.findMany({
      where: { date: { gte: new Date(range.gte.getTime() - 14 * 24 * 60 * 60 * 1000) } },
      select: { date: true, status: true },
    }),
    db.payment.findMany({
      where: { paidAt: { gte: sixMonthsAgo } },
      select: { amount: true, paidAt: true },
    }),
    db.fee.findMany({
      where: { dueDate: { gte: sixMonthsAgo } },
      select: { amount: true, dueDate: true },
    }),
    db.announcement.findMany({
      include: { class: true, publishedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const todayMarked = todayRecords.length;
  const todayPresent = todayRecords.filter((r) => r.status === "PRESENT").length;

  const pendingFeeAmount = round2(
    unpaidFees.reduce((sum, f) => sum + outstandingOf(toMoney(f.amount), toMoney(f.paidAmount)), 0)
  );
  const pendingFeeCount = unpaidFees.filter((f) => outstandingOf(toMoney(f.amount), toMoney(f.paidAmount)) > 0).length;

  // 7-day attendance trend: bucket by UTC day, keep days that have any marks.
  const dayBuckets = new Map<string, { marked: number; present: number }>();
  for (const rec of trendRecords) {
    const key = rec.date.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key) ?? { marked: 0, present: 0 };
    bucket.marked += 1;
    if (rec.status === "PRESENT") bucket.present += 1;
    dayBuckets.set(key, bucket);
  }
  const attendanceTrend = Array.from(dayBuckets.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-7)
    .map(([date, b]) => ({ date, percentage: pct(b.present, b.marked) }));

  // 6-month fee collection: payments by paidAt month + fees due by dueDate month.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const collectedByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  const dueByMonth = new Map<string, number>(months.map((m) => [m, 0]));
  for (const p of recentPayments) {
    const key = p.paidAt.toISOString().slice(0, 7);
    if (collectedByMonth.has(key)) {
      collectedByMonth.set(key, round2((collectedByMonth.get(key) ?? 0) + toMoney(p.amount)));
    }
  }
  for (const f of upcomingFeeDues) {
    const key = f.dueDate.toISOString().slice(0, 7);
    if (dueByMonth.has(key)) {
      dueByMonth.set(key, round2((dueByMonth.get(key) ?? 0) + toMoney(f.amount)));
    }
  }
  const feeCollection = months.map((month) => ({
    month,
    collected: collectedByMonth.get(month) ?? 0,
    due: dueByMonth.get(month) ?? 0,
  }));

  return {
    stats: {
      students,
      teachers,
      classes,
      todayAttendancePct: pct(todayPresent, todayMarked),
      todayAttendanceMarked: todayMarked,
      pendingFeeAmount,
      pendingFeeCount,
    },
    charts: {
      gender: genderGroups.map((g) => ({ name: g.gender ?? "OTHER", value: g._count })),
      studentsByClass: classChart
        .map((c) => ({ name: c.name, value: c._count.students }))
        .sort((a, b) => naturalCompare(a.name, b.name)),
      attendanceTrend,
      feeCollection,
    },
    announcements: announcements.map(toAnnouncementDTO),
  };
}

// ── TEACHER ────────────────────────────────────────────────

async function teacherDashboard(userId: string) {
  const teacher = await db.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ApiError(404, "Teacher profile not found");

  const today = todayISO();
  const todayName = todayDayName();
  const range = dayRangeUTC(today);
  const todayStart = range.gte;

  const classIds = await getTeacherClassIds(teacher.id);

  const [myClassRows, upcomingExamRows, scheduleRows, markedToday, announcements] = await Promise.all([
    db.class.findMany({
      where: { id: { in: classIds } },
      select: {
        id: true,
        name: true,
        _count: { select: { students: { where: { status: "ACTIVE" } }, subjects: true } },
      },
    }),
    db.exam.findMany({
      where: { classId: { in: classIds }, startDate: { gte: todayStart }, status: { not: "COMPLETED" } },
      include: examInclude,
      orderBy: { startDate: "asc" },
      take: 5,
    }),
    db.timetable.findMany({
      where: { teacherId: teacher.id, day: todayName },
      include: timetableInclude,
    }),
    classIds.length > 0
      ? db.attendance.findMany({
          where: { classId: { in: classIds }, date: range },
          select: { classId: true },
          distinct: ["classId"],
        })
      : Promise.resolve([] as { classId: string }[]),
    db.announcement.findMany({
      where: announcementWhereFor("TEACHER", { teacherClassIds: classIds }),
      include: { class: true, publishedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const myClasses = myClassRows
    .map((c) => ({
      id: c.id,
      name: c.name,
      studentCount: c._count.students,
      subjectCount: c._count.subjects,
    }))
    .sort((a, b) => naturalCompare(a.name, b.name));

  const todaySchedule = sortTimetable(scheduleRows).map(toTimetableDTO);
  const markedClassIds = new Set(markedToday.map((m) => m.classId));
  const pendingAttendance = classIds.filter((id) => !markedClassIds.has(id)).length;

  return {
    stats: {
      classes: myClasses.length,
      students: myClasses.reduce((s, c) => s + c.studentCount, 0),
      todayClasses: todaySchedule.length,
      pendingAttendance,
    },
    myClasses,
    upcomingExams: upcomingExamRows.map(toExamDTO),
    todaySchedule,
    announcements: announcements.map(toAnnouncementDTO),
  };
}

// ── STUDENT ────────────────────────────────────────────────

async function studentDashboard(userId: string) {
  const student = await db.student.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  if (!student) throw new ApiError(404, "Student profile not found");

  const today = todayISO();
  const todayName = todayDayName();
  const range = dayRangeUTC(today);
  const todayStart = range.gte;

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));

  const [attRows, monthRows, gpa, unpaidFees, upcomingExamRows, recentResultRows, scheduleRows, announcements] =
    await Promise.all([
      db.attendance.findMany({ where: { studentId: student.id }, select: { status: true } }),
      db.attendance.findMany({
        where: { studentId: student.id, date: { gte: monthStart, lt: nextMonthStart } },
        select: { status: true },
      }),
      computeGpaForStudent(student.id),
      db.fee.findMany({ where: { studentId: student.id, status: { not: "PAID" } }, select: { amount: true, paidAmount: true } }),
      student.classId
        ? db.exam.findMany({
            where: { classId: student.classId, startDate: { gte: todayStart }, status: { not: "COMPLETED" } },
            include: examInclude,
            orderBy: { startDate: "asc" },
            take: 5,
          })
        : Promise.resolve([]),
      db.result.findMany({
        where: { studentId: student.id },
        include: { exam: { select: { name: true } }, subject: { select: { name: true } } },
        orderBy: { exam: { endDate: "desc" } },
        take: 8,
      }),
      student.classId
        ? db.timetable.findMany({ where: { classId: student.classId, day: todayName }, include: timetableInclude })
        : Promise.resolve([]),
      db.announcement.findMany({
        where: announcementWhereFor("STUDENT", { studentClassId: student.classId }),
        include: { class: true, publishedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const counts = attendanceCounts(attRows);
  const monthCounts = attendanceCounts(monthRows);

  return {
    student: {
      id: student.id,
      studentId: student.studentId,
      name: student.user.name,
      className: student.class?.name ?? "",
      sectionName: student.section?.name ?? null,
      rollNumber: student.rollNumber,
    },
    stats: {
      attendancePct: counts.percentage,
      attendanceThisMonth: { present: monthCounts.present, total: monthCounts.total },
      gpa,
      pendingFees: unpaidFees.filter((f) => outstandingOf(toMoney(f.amount), toMoney(f.paidAmount)) > 0).length,
      upcomingExams: upcomingExamRows.length,
    },
    recentResults: recentResultRows.map((r) => ({
      examName: r.exam.name,
      subjectName: r.subject.name,
      marks: r.marks,
      grade: r.grade,
    })),
    upcomingExams: upcomingExamRows.map(toExamDTO),
    announcements: announcements.map(toAnnouncementDTO),
    todaySchedule: sortTimetable(scheduleRows).map(toTimetableDTO),
  };
}

// ── PARENT ─────────────────────────────────────────────────

async function parentDashboard(userId: string) {
  const parent = await db.parent.findUnique({ where: { userId } });
  if (!parent) throw new ApiError(404, "Parent profile not found");

  const children = await db.student.findMany({
    where: { parentId: parent.id, status: "ACTIVE" },
    include: {
      user: { select: { name: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });

  const childrenClassIds = children.map((c) => c.classId).filter((id): id is string => Boolean(id));

  const [overviews, announcements] = await Promise.all([
    Promise.all(
      children.map(async (child) => {
        const [attRows, resultRows, unpaidFees, latestResult] = await Promise.all([
          db.attendance.findMany({ where: { studentId: child.id }, select: { status: true } }),
          db.result.findMany({ where: { studentId: child.id }, select: { marks: true } }),
          db.fee.findMany({ where: { studentId: child.id, status: { not: "PAID" } }, select: { amount: true, paidAmount: true } }),
          db.result.findFirst({
            where: { studentId: child.id },
            orderBy: { exam: { endDate: "desc" } },
            select: { grade: true },
          }),
        ]);
        const counts = attendanceCounts(attRows);
        return {
          student: {
            id: child.id,
            studentId: child.studentId,
            name: child.user.name,
            className: child.class?.name ?? "",
            sectionName: child.section?.name ?? null,
            rollNumber: child.rollNumber,
          },
          attendancePct: counts.percentage,
          gpa: resultRows.length > 0 ? overallFor(resultRows.map((r) => r.marks)).gpa : null,
          pendingFeeAmount: round2(unpaidFees.reduce((s, f) => s + outstandingOf(toMoney(f.amount), toMoney(f.paidAmount)), 0)),
          recentGrade: latestResult?.grade ?? null,
        };
      })
    ),
    db.announcement.findMany({
      where: announcementWhereFor("PARENT", { childrenClassIds }),
      include: { class: true, publishedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    children: overviews,
    announcements: announcements.map(toAnnouncementDTO),
  };
}
