/**
 * EduSphere SMS — Shared API types (single source of truth).
 * All dates cross the wire as ISO strings. All JSON bodies are plain objects.
 */

export type Role = "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
export type FeeStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
export type FeeType = "TUITION" | "ADMISSION" | "EXAM" | "TRANSPORT" | "LIBRARY" | "OTHER";
export type AudienceType = "ALL" | "TEACHERS" | "STUDENTS" | "PARENTS" | "SPECIFIC_CLASS";
export type ExamStatus = "SCHEDULED" | "ONGOING" | "COMPLETED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type PaymentMethod = "CASH" | "BKASH" | "NAGAD" | "BANK";
export type WeekDay =
  | "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

// ── Users ──────────────────────────────────────────────────

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  phone: string | null;
  status: UserStatus;
}

// ── Students ───────────────────────────────────────────────

export interface ClassBrief { id: string; name: string }
export interface SectionBrief { id: string; name: string; classId: string }
export interface ParentBrief { id: string; name: string }

export interface StudentDTO {
  id: string;
  studentId: string;
  rollNumber: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: string | null;
  admissionDate: string;
  status: UserStatus;
  user: PublicUser;
  class: ClassBrief | null;
  section: SectionBrief | null;
  parent: ParentBrief | null;
}

export interface StudentDetailDTO extends StudentDTO {
  attendanceSummary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    leave: number;
    percentage: number;
  };
  feeSummary: { due: number; totalDue: number };
  gpa: number | null;
}

export interface StudentListResponse {
  students: StudentDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StudentCreateInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  classId?: string;
  sectionId?: string;
  parentId?: string;
  rollNumber?: string;
  status?: UserStatus;
}

export type StudentUpdateInput = Partial<StudentCreateInput>;

// ── Teachers ───────────────────────────────────────────────

export interface SubjectBrief { id: string; name: string; code: string; classId: string; className: string }

export interface TeacherDTO {
  id: string;
  teacherId: string;
  department: string | null;
  joiningDate: string;
  status: UserStatus;
  user: PublicUser;
  subjects: SubjectBrief[];
  classes: ClassBrief[];
}

export interface TeacherListResponse {
  teachers: TeacherDTO[];
  total: number;
}

export interface TeacherCreateInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  department?: string;
  joiningDate?: string;
  status?: UserStatus;
}

export type TeacherUpdateInput = Partial<TeacherCreateInput>;

// ── Parents ────────────────────────────────────────────────

export interface ParentDTO {
  id: string;
  user: PublicUser;
  phone: string | null;
  address: string | null;
  children: { id: string; name: string; studentId: string; className: string | null; sectionName: string | null }[];
}

export interface ParentListResponse {
  parents: ParentDTO[];
  total: number;
}

export interface ParentCreateInput {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
}

export type ParentUpdateInput = Partial<ParentCreateInput>;

// ── Classes / Sections / Subjects ──────────────────────────

export interface ClassDTO {
  id: string;
  name: string;
  academicYear: string;
  sections: SectionBrief[];
  subjectCount: number;
  studentCount: number;
  classTeachers: { id: string; name: string }[];
}

export interface SubjectDTO {
  id: string;
  name: string;
  code: string;
  classId: string;
  className: string;
  teacher: { id: string; name: string } | null;
}

// ── Attendance ─────────────────────────────────────────────

export interface AttendanceRosterRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: AttendanceStatus | null; // null → not yet marked
}

export interface AttendanceRosterResponse {
  classId: string;
  date: string;
  records: AttendanceRosterRow[];
  markedCount: number;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  percentage: number;
  recent: { date: string; status: AttendanceStatus }[];
}

// ── Exams & Results ────────────────────────────────────────

export interface ExamDTO {
  id: string;
  name: string;
  classId: string;
  className: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  resultCount: number;
}

export interface MarksRosterRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marks: number | null; // null → not entered
}

export interface MarksRosterResponse {
  examId: string;
  subjectId: string;
  records: MarksRosterRow[];
  enteredCount: number;
}

export interface SubjectResultDTO {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  marks: number;
  grade: string;
  gpa: number;
}

export interface StudentResultSheet {
  student: { id: string; studentId: string; name: string; className: string; sectionName: string | null };
  exam: { id: string; name: string };
  results: SubjectResultDTO[];
  total: number;
  average: number;
  gpa: number;
  overallGrade: string;
}

// ── Fees ───────────────────────────────────────────────────

export interface PaymentDTO {
  id: string;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  paidAt: string;
}

export interface FeeDTO {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  title: string;
  type: FeeType;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: FeeStatus;
  payments: PaymentDTO[];
}

export interface FeeListResponse {
  fees: FeeDTO[];
  total: number;
  summary: { totalDue: number; totalCollected: number; pendingCount: number; overdueCount: number };
}

// ── Announcements ──────────────────────────────────────────

export interface AnnouncementDTO {
  id: string;
  title: string;
  content: string;
  targetAudience: AudienceType;
  class: ClassBrief | null;
  publishedBy: string;
  createdAt: string;
}

// ── Timetable ──────────────────────────────────────────────

export interface TimetableEntryDTO {
  id: string;
  classId: string;
  className: string;
  day: WeekDay;
  period: number;
  startTime: string;
  endTime: string;
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
}

// ── Dashboards ─────────────────────────────────────────────

export interface AdminDashboard {
  stats: {
    students: number;
    teachers: number;
    classes: number;
    todayAttendancePct: number;
    todayAttendanceMarked: number;
    pendingFeeAmount: number;
    pendingFeeCount: number;
  };
  charts: {
    gender: { name: string; value: number }[];
    studentsByClass: { name: string; value: number }[];
    attendanceTrend: { date: string; percentage: number }[];
    feeCollection: { month: string; collected: number; due: number }[];
  };
  announcements: AnnouncementDTO[];
}

export interface TeacherDashboard {
  stats: {
    classes: number;
    students: number;
    todayClasses: number;
    pendingAttendance: number;
  };
  myClasses: { id: string; name: string; studentCount: number; subjectCount: number }[];
  upcomingExams: ExamDTO[];
  todaySchedule: TimetableEntryDTO[];
  announcements: AnnouncementDTO[];
}

export interface StudentDashboard {
  student: { id: string; studentId: string; name: string; className: string; sectionName: string | null; rollNumber: string };
  stats: {
    attendancePct: number;
    attendanceThisMonth: { present: number; total: number };
    gpa: number | null;
    pendingFees: number;
    upcomingExams: number;
  };
  recentResults: { examName: string; subjectName: string; marks: number; grade: string }[];
  upcomingExams: ExamDTO[];
  announcements: AnnouncementDTO[];
  todaySchedule: TimetableEntryDTO[];
}

export interface ChildOverview {
  student: { id: string; studentId: string; name: string; className: string; sectionName: string | null; rollNumber: string };
  attendancePct: number;
  gpa: number | null;
  pendingFeeAmount: number;
  recentGrade: string | null;
}

export interface ParentDashboard {
  children: ChildOverview[];
  announcements: AnnouncementDTO[];
}

// ── Navigation (frontend) ──────────────────────────────────

export interface NavItem {
  key: string;       // e.g. "admin:students"
  label: string;
  icon: string;      // lucide icon name, resolved by AppShell
}
