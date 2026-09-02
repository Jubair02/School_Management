/**
 * School Management System — Database Seed
 * Run: bun prisma/seed.ts
 *
 * Demo accounts (all passwords: Role@123 pattern):
 *   Admin   → admin@edusphere.test   / Admin@123
 *   Teacher → teacher@edusphere.test / Teacher@123  (+ 4 more teachers)
 *   Student → student@edusphere.test / Student@123  (+ 11 more)
 *   Parent  → parent@edusphere.test  / Parent@123   (+ 2 more)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const hash = (pw: string) => bcrypt.hashSync(pw, 10);

// Bangladeshi SSC-style grading
function gradeFor(marks: number): { grade: string; gpa: number } {
  if (marks >= 80) return { grade: "A+", gpa: 5.0 };
  if (marks >= 70) return { grade: "A", gpa: 4.0 };
  if (marks >= 60) return { grade: "A-", gpa: 3.5 };
  if (marks >= 50) return { grade: "B", gpa: 3.0 };
  if (marks >= 40) return { grade: "C", gpa: 2.0 };
  if (marks >= 33) return { grade: "D", gpa: 1.0 };
  return { grade: "F", gpa: 0.0 };
}

// deterministic pseudo-random
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

function pad(n: number): string {
  return n.toString().padStart(4, "0");
}

// date helpers — use local dates to avoid TZ drift
function at(d: Date, hours = 0, minutes = 0): Date {
  const x = new Date(d);
  x.setHours(hours, minutes, 0, 0);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

async function main() {
  console.log("🧹 Clearing existing data...");
  await db.payment.deleteMany();
  await db.fee.deleteMany();
  await db.result.deleteMany();
  await db.exam.deleteMany();
  await db.attendance.deleteMany();
  await db.timetable.deleteMany();
  await db.announcement.deleteMany();
  await db.teacherClass.deleteMany();
  await db.subject.deleteMany();
  await db.section.deleteMany();
  await db.exam.deleteMany();
  await db.student.deleteMany();
  await db.teacher.deleteMany();
  await db.parent.deleteMany();
  await db.class.deleteMany();
  await db.passwordReset.deleteMany();
  await db.user.deleteMany();

  const YEAR = "2025";
  const now = new Date();

  console.log("👑 Creating admin...");
  await db.user.create({
    data: {
      name: "Dr. Anisur Rahman",
      email: "admin@edusphere.test",
      password: hash("Admin@123"),
      role: "ADMIN",
      phone: "+880 1711-000001",
    },
  });
  const adminUser = await db.user.findUniqueOrThrow({ where: { email: "admin@edusphere.test" } });

  // ── Teachers ──────────────────────────────────────────────
  console.log("👨‍🏫 Creating teachers...");
  const teacherDefs = [
    { name: "Mahmudul Hasan", email: "teacher@edusphere.test", dept: "Mathematics", subjectOf: "Mathematics" },
    { name: "Farhana Akter", email: "farhana@edusphere.test", dept: "English", subjectOf: "English" },
    { name: "Rakibul Islam", email: "rakib@edusphere.test", dept: "Science", subjectOf: "Physics" },
    { name: "Nusrat Jahan", email: "nusrat@edusphere.test", dept: "Science", subjectOf: "Chemistry" },
    { name: "Sabbir Ahmed", email: "sabbir@edusphere.test", dept: "ICT", subjectOf: "ICT" },
    { name: "Tanjina Alam", email: "tanjina@edusphere.test", dept: "Science", subjectOf: "Biology" },
  ];
  const teachers: { id: string; userId: string; name: string; subjectOf: string }[] = [];
  for (let i = 0; i < teacherDefs.length; i++) {
    const t = teacherDefs[i];
    const u = await db.user.create({
      data: {
        name: t.name,
        email: t.email,
        password: hash("Teacher@123"),
        role: "TEACHER",
        phone: `+880 1711-0000${i + 1}`,
      },
    });
    const rec = await db.teacher.create({
      data: {
        userId: u.id,
        teacherId: `TCH-${YEAR}-${pad(i + 1)}`,
        department: t.dept,
        joiningDate: new Date(2020 + (i % 4), int(0, 11), int(1, 27)),
      },
    });
    teachers.push({ id: rec.id, userId: u.id, name: t.name, subjectOf: t.subjectOf });
  }

  // ── Classes, sections, subjects ───────────────────────────
  console.log("🏫 Creating classes, sections, subjects...");
  const classDefs = ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const classes: { id: string; name: string }[] = [];
  for (const name of classDefs) {
    const c = await db.class.create({ data: { name, academicYear: YEAR } });
    classes.push({ id: c.id, name: c.name });
    for (const s of ["A", "B"]) {
      await db.section.create({ data: { name: s, classId: c.id } });
    }
  }

  const seniorSubjects = ["Mathematics", "English", "Physics", "Chemistry", "Biology", "ICT"];
  const juniorSubjects = ["Mathematics", "English", "General Science", "Social Science", "ICT"];
  const subjectCodes: Record<string, string> = {
    Mathematics: "MATH",
    English: "ENG",
    Physics: "PHY",
    Chemistry: "CHEM",
    Biology: "BIO",
    ICT: "ICT",
    "General Science": "GSCI",
    "Social Science": "SOSC",
  };

  const subjectTeacher: Record<string, string> = {
    Mathematics: "Mathematics",
    English: "English",
    Physics: "Physics",
    Chemistry: "Chemistry",
    Biology: "Biology",
    ICT: "ICT",
    "General Science": "Physics",
    "Social Science": "English",
  };

  const subjectsByClass: Record<string, { id: string; name: string }[]> = {};
  for (const c of classes) {
    const list = parseInt(c.name.replace("Grade ", "")) >= 9 ? seniorSubjects : juniorSubjects;
    subjectsByClass[c.id] = [];
    for (const sName of list) {
      const teacher = teachers.find((t) => t.subjectOf === subjectTeacher[sName])!;
      const s = await db.subject.create({
        data: {
          name: sName,
          code: `${subjectCodes[sName]}-${c.name.replace("Grade ", "")}`,
          classId: c.id,
          teacherId: teacher.id,
        },
      });
      subjectsByClass[c.id].push({ id: s.id, name: s.name });
    }
  }

  // class teachers (first section gets first-listed teacher etc.)
  console.log("📌 Assigning class teachers...");
  for (const c of classes) {
    const t = teachers[int(0, teachers.length - 1)];
    await db.teacherClass.create({ data: { teacherId: t.id, classId: c.id } });
  }

  // ── Parents ───────────────────────────────────────────────
  console.log("👨‍👩‍👧 Creating parents...");
  const parentDefs = [
    { name: "Md. Siddique Ahmed", email: "parent@edusphere.test", phone: "+880 1811-000001", address: "House 12, Road 5, Dhanmondi, Dhaka" },
    { name: "Abdul Karim", email: "karim@edusphere.test", phone: "+880 1811-000002", address: "Flat 3B, Uttara Sector 7, Dhaka" },
    { name: "Rasheda Begum", email: "rasheda@edusphere.test", phone: "+880 1811-000003", address: "14/A Mirpur DOHS, Dhaka" },
  ];
  const parents: { id: string; userId: string }[] = [];
  for (const p of parentDefs) {
    const u = await db.user.create({
      data: { name: p.name, email: p.email, password: hash("Parent@123"), role: "PARENT", phone: p.phone },
    });
    const rec = await db.parent.create({
      data: { userId: u.id, phone: p.phone, address: p.address },
    });
    parents.push({ id: rec.id, userId: u.id });
  }

  // ── Students ──────────────────────────────────────────────
  console.log("👨‍🎓 Creating students...");
  const studentDefs = [
    { name: "Jubair Ahmed", email: "student@edusphere.test", gender: "MALE", cls: "Grade 10", sec: "A", parentIdx: 0 },
    { name: "Ayesha Siddiqua", email: "ayesha@edusphere.test", gender: "FEMALE", cls: "Grade 10", sec: "A", parentIdx: 0 },
    { name: "Tanvir Hasan", email: "tanvir@edusphere.test", gender: "MALE", cls: "Grade 10", sec: "A", parentIdx: 1 },
    { name: "Maliha Rahman", email: "maliha@edusphere.test", gender: "FEMALE", cls: "Grade 10", sec: "B", parentIdx: 2 },
    { name: "Imran Chowdhury", email: "imran@edusphere.test", gender: "MALE", cls: "Grade 10", sec: "B", parentIdx: 1 },
    { name: "Sadia Islam", email: "sadia@edusphere.test", gender: "FEMALE", cls: "Grade 9", sec: "A", parentIdx: 2 },
    { name: "Rafiul Karim", email: "rafiul@edusphere.test", gender: "MALE", cls: "Grade 9", sec: "A", parentIdx: 1 },
    { name: "Nabila Haque", email: "nabila@edusphere.test", gender: "FEMALE", cls: "Grade 9", sec: "B", parentIdx: 0 },
    { name: "Arif Mahmud", email: "arif@edusphere.test", gender: "MALE", cls: "Grade 9", sec: "B", parentIdx: 2 },
    { name: "Fariha Akter", email: "fariha@edusphere.test", gender: "FEMALE", cls: "Grade 8", sec: "A", parentIdx: 1 },
    { name: "Shakib Al Hasan", email: "shakib@edusphere.test", gender: "MALE", cls: "Grade 8", sec: "A", parentIdx: 2 },
    { name: "Sumaiya Binte Noor", email: "sumaiya@edusphere.test", gender: "FEMALE", cls: "Grade 8", sec: "B", parentIdx: 0 },
  ];

  const sectionRecords = await db.section.findMany({ include: { class: true } });
  const students: { id: string; userId: string; classId: string; name: string }[] = [];

  for (let i = 0; i < studentDefs.length; i++) {
    const d = studentDefs[i];
    const roll = d.cls + d.sec === "Grade 10A" || d.cls + d.sec === "Grade 9A" ? String(studentDefs.filter(x => x.cls === d.cls && x.sec === d.sec).indexOf(d) + 1).padStart(2, "0") : String(int(1, 20)).padStart(2, "0");
    const sec = sectionRecords.find((s) => s.class.name === d.cls && s.name === d.sec)!;
    const u = await db.user.create({
      data: {
        name: d.name,
        email: d.email,
        password: hash("Student@123"),
        role: "STUDENT",
        phone: `+880 19${int(10, 99)}-${int(100000, 999999)}`,
      },
    });
    const rec = await db.student.create({
      data: {
        userId: u.id,
        studentId: `STU-${YEAR}-${pad(i + 1)}`,
        rollNumber: roll,
        dateOfBirth: new Date(2008 + (parseInt(d.cls.replace("Grade ", "")) % 4), int(0, 11), int(1, 27)),
        gender: d.gender,
        address: pick(["Dhanmondi, Dhaka", "Uttara, Dhaka", "Mirpur, Dhaka", "Banani, Dhaka", "Mohammadpur, Dhaka"]),
        classId: sec.classId,
        sectionId: sec.id,
        parentId: parents[d.parentIdx].id,
        admissionDate: new Date(YEAR as number, 0, int(2, 15)),
      },
    });
    students.push({ id: rec.id, userId: u.id, classId: sec.classId, name: d.name });
  }

  // ── Attendance: last 30 weekdays per student ──────────────
  console.log("📅 Creating attendance records...");
  const attendanceRows: {
    studentId: string; classId: string; date: Date; status: string; markedById: string;
  }[] = [];
  const days: Date[] = [];
  for (let i = 1; days.length < 24 && i < 40; i++) {
    const d = addDays(now, -i);
    const dow = d.getDay();
    if (dow !== 5) days.push(d); // skip Fridays (weekend in BD)
  }
  for (const st of students) {
    for (const day of days) {
      const r = rand();
      const status = r < 0.86 ? "PRESENT" : r < 0.93 ? "ABSENT" : r < 0.97 ? "LATE" : "LEAVE";
      attendanceRows.push({
        studentId: st.id,
        classId: st.classId,
        date: at(day, 9),
        status,
        markedById: teachers[0].userId,
      });
    }
  }
  // create in chunks
  for (let i = 0; i < attendanceRows.length; i += 100) {
    await db.attendance.createMany({ data: attendanceRows.slice(i, i + 100) });
  }
  // today's attendance: mark for half the classes only (so teacher has "pending attendance")
  const todayMarked = students.slice(0, 8);
  for (const st of todayMarked) {
    await db.attendance.createMany({
      data: [{ studentId: st.id, classId: st.classId, date: at(now, 9), status: rand() < 0.9 ? "PRESENT" : "LATE", markedById: teachers[0].userId }],
    }).catch(() => {});
  }

  // ── Exams ─────────────────────────────────────────────────
  console.log("📝 Creating exams...");
  const exams: { id: string; classId: string; name: string }[] = [];
  for (const c of classes) {
    const e = await db.exam.create({
      data: {
        name: "Mid Term Exam",
        classId: c.id,
        startDate: addDays(now, -14),
        endDate: addDays(now, -7),
        status: "COMPLETED",
      },
    });
    exams.push({ id: e.id, classId: c.id, name: e.name });
  }
  // upcoming exam for a couple of classes
  for (const c of classes.slice(3)) {
    await db.exam.create({
      data: {
        name: "Final Term Exam",
        classId: c.id,
        startDate: addDays(now, 21),
        endDate: addDays(now, 30),
        status: "SCHEDULED",
      },
    });
  }

  // ── Results for completed exams ───────────────────────────
  console.log("🧮 Computing results...");
  const completedExams = exams;
  for (const e of completedExams) {
    const classStudents = students.filter((s) => s.classId === e.classId);
    const subs = subjectsByClass[e.classId];
    for (const st of classStudents) {
      const ability = 40 + rand() * 55; // student ability baseline
      for (const sub of subs) {
        const marks = Math.max(21, Math.min(99, Math.round(ability + (rand() - 0.5) * 24)));
        const { grade, gpa } = gradeFor(marks);
        await db.result.create({
          data: { studentId: st.id, examId: e.id, subjectId: sub.id, marks, grade, gpa },
        });
      }
    }
  }

  // ── Fees ──────────────────────────────────────────────────
  console.log("💰 Creating fees & payments...");
  for (const st of students) {
    // tuition fee — current month
    const tuitionStatus = pick(["PENDING", "PARTIAL", "PAID", "OVERDUE"]);
    const tuitionAmount = 2500;
    const paid = tuitionStatus === "PAID" ? tuitionAmount : tuitionStatus === "PARTIAL" ? 1200 : 0;
    const tuition = await db.fee.create({
      data: {
        studentId: st.id,
        title: `Tuition Fee — ${now.toLocaleString("en", { month: "long" })} ${YEAR}`,
        type: "TUITION",
        amount: tuitionAmount,
        paidAmount: paid,
        dueDate: at(addDays(now, 10), 23, 59),
        status: tuitionStatus === "PARTIAL" ? "PARTIAL" : tuitionStatus === "PAID" ? "PAID" : "PENDING",
      },
    });
    if (paid > 0) {
      await db.payment.create({
        data: { feeId: tuition.id, amount: paid, method: pick(["CASH", "BKASH", "NAGAD"]), paidAt: addDays(now, -int(1, 5)), receivedById: adminUser.id },
      });
    }
    // overdue transport fee
    if (rand() < 0.4) {
      const tf = await db.fee.create({
        data: {
          studentId: st.id,
          title: "Transport Fee — Last Month",
          type: "TRANSPORT",
          amount: 800,
          paidAmount: 0,
          dueDate: at(addDays(now, -20), 23, 59),
          status: "PENDING",
        },
      });
      await db.fee.update({ where: { id: tf.id }, data: { status: "OVERDUE" } });
    }
    // paid exam fee
    const ef = await db.fee.create({
      data: {
        studentId: st.id,
        title: "Mid Term Exam Fee",
        type: "EXAM",
        amount: 500,
        paidAmount: 500,
        dueDate: at(addDays(now, -25), 23, 59),
        status: "PAID",
      },
    });
    await db.payment.create({
      data: { feeId: ef.id, amount: 500, method: "CASH", paidAt: addDays(now, -26), receivedById: adminUser.id },
    });
  }

  // ── Announcements ─────────────────────────────────────────
  console.log("📢 Creating announcements...");
  const grade10 = classes.find((c) => c.name === "Grade 10")!;
  await db.announcement.createMany({
    data: [
      {
        title: "School will remain closed tomorrow",
        content: "Dear all, due to unavoidable circumstances the school will remain closed tomorrow. Regular classes will resume the following day. — Principal's Office",
        targetAudience: "ALL",
        publishedById: adminUser.id,
      },
      {
        title: "Mid Term results published",
        content: "Mid Term Exam results have been published. Students and parents can view subject-wise marks, GPA and grades from the Results section.",
        targetAudience: "STUDENTS",
        publishedById: adminUser.id,
      },
      {
        title: "Parent–Teacher Meeting on Saturday",
        content: "A parent–teacher meeting will be held this Saturday from 10:00 AM to 1:00 PM. Parents are requested to collect their child's progress report from the class teacher.",
        targetAudience: "PARENTS",
        publishedById: adminUser.id,
      },
      {
        title: "Extra Mathematics class for Grade 10",
        content: "An extra Mathematics class will be held on Thursday, 3:00 PM for Grade 10 students preparing for the board exam.",
        targetAudience: "SPECIFIC_CLASS",
        classId: grade10.id,
        publishedById: adminUser.id,
      },
      {
        title: "Staff meeting after last period",
        content: "All teachers are requested to attend the monthly staff coordination meeting after the last period on Wednesday.",
        targetAudience: "TEACHERS",
        publishedById: adminUser.id,
      },
    ],
  });

  // ── Timetable for Grade 9 & 10 ────────────────────────────
  console.log("🕐 Creating timetables...");
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"];
  const periods = [
    { period: 1, startTime: "09:00", endTime: "09:45" },
    { period: 2, startTime: "09:50", endTime: "10:35" },
    { period: 3, startTime: "10:40", endTime: "11:25" },
    { period: 4, startTime: "11:45", endTime: "12:30" },
    { period: 5, startTime: "12:35", endTime: "13:20" },
    { period: 6, startTime: "13:25", endTime: "14:10" },
  ];
  for (const c of classes.slice(3)) {
    const subs = subjectsByClass[c.id];
    for (const day of dayNames) {
      for (const p of periods) {
        const sub = subs[(p.period + dayNames.indexOf(day)) % subs.length];
        const teacherRec = teachers.find((t) => t.subjectOf === subjectTeacher[sub.name])!;
        await db.timetable.create({
          data: {
            classId: c.id,
            day,
            period: p.period,
            startTime: p.startTime,
            endTime: p.endTime,
            subjectId: sub.id,
            teacherId: teacherRec.id,
          },
        });
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────
  const counts = {
    users: await db.user.count(),
    students: await db.student.count(),
    teachers: await db.teacher.count(),
    parents: await db.parent.count(),
    classes: await db.class.count(),
    subjects: await db.subject.count(),
    attendance: await db.attendance.count(),
    exams: await db.exam.count(),
    results: await db.result.count(),
    fees: await db.fee.count(),
    announcements: await db.announcement.count(),
    timetable: await db.timetable.count(),
  };
  console.log("✅ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
