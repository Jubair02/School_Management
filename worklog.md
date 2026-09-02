# Worklog — EduSphere School Management System (MVP)

Shared worklog for all agents. Read before starting. Append after finishing each Task ID.

---

Task ID: 1
Agent: Z.ai Code (orchestrator)
Task: Foundation — Prisma schema, database seed, shared types, API contract.

Work Log:
- Installed `bcryptjs`, `jose` (+ @types/bcryptjs). recharts, zod, zustand, @tanstack/react-query, sonner already present.
- Wrote full domain schema in `prisma/schema.prisma` (SQLite): User, PasswordReset, Student, Teacher, Parent, Class, Section, Subject, TeacherClass, Attendance, Exam, Result, Fee, Payment, Announcement, Timetable. SQLite → no enums/lists; role/status/type fields are String.
- `bun run db:push` succeeded. DATABASE_URL=file:/home/z/my-project/db/custom.db
- Wrote + ran `prisma/seed.ts` (`bun prisma/seed.ts`). Seed counts: users 22, students 12, teachers 6, parents 3, classes 5 (Grade 6–10, sections A/B), subjects 27, attendance 296 (last ~24 weekdays + partial today), exams 7 (Mid Term completed for all classes + Final Term upcoming for 9–10), results 69, fees 28 w/ payments, announcements 5, timetable 60 (Grade 9–10).
- Wrote shared DTO contract `src/lib/types.ts` — ALL API payloads must match these interfaces.

Stage Summary:
- DEMO LOGIN ACCOUNTS (shown on login page):
  - admin@edusphere.test / Admin@123
  - teacher@edusphere.test / Teacher@123 (Mahmudul Hasan — Mathematics, Grade 9+10)
  - student@edusphere.test / Student@123 (Jubair Ahmed — Grade 10 A, has parent + full results)
  - parent@edusphere.test / Parent@123 (Md. Siddique Ahmed — 2 children)
- GRADING (BD SSC style, util shared by backend & seed): >=80 A+/5.0, 70 A/4.0, 60 A-/3.5, 50 B/3.0, 40 C/2.0, 33 D/1.0, else F/0.0.
- Dev server already running on port 3000 (logs: /home/z/my-project/dev.log). Do NOT run `bun run build`. Do NOT run global `bun run lint` (orchestrator does final lint).

## API CONTRACT (v1 — authoritative for Tasks 2-a, 2-b, 3-a, 3-b)

General rules:
- All routes under `src/app/api/...` (route handlers, Next.js 16: `params` is a Promise — `const { id } = await params`).
- Auth: JWT (jose, HS256) in httpOnly cookie `sms_token`. Secret: `process.env.AUTH_SECRET ?? "edusphere-dev-secret-change-me"`.
- Success → JSON payload directly (shapes below). Failure → `{ error: string }` with status 400/401/403/404/500.
- Helper contract for 2-a: `src/lib/auth.ts` exports `signToken(payload)`, `verifyToken(token)`, `COOKIE_NAME`; `src/lib/api-auth.ts` exports `requireAuth(req, roles?: Role[])` → `{ user: PublicUser }` or throws `NextResponse` 401/403 (agent implements; use `ApiError` class + `handle()` wrapper pattern).
- Dates: ISO strings. SQLite stores Date objects; serialize with `.toISOString()`.

### Auth
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | /api/auth/login | — | {email, password} | `{ user: PublicUser }` + sets cookie; 401 invalid creds; 403 if status INACTIVE |
| POST | /api/auth/logout | — | — | `{ success: true }` (clears cookie) |
| GET | /api/auth/me | any | — | `{ user: PublicUser }` or 401 |
| POST | /api/auth/forgot-password | — | {email} | `{ token: string, name: string }` (dev-mode token, 404 unknown email) |
| POST | /api/auth/reset-password | — | {token, password} | `{ success: true }` (marks token used, min 6 chars) |

### Students
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/students?query&classId&sectionId&status&page&pageSize | ADMIN, TEACHER | `{...StudentListResponse}`; query matches name/email/studentId; default pageSize 50 |
| POST | /api/students | ADMIN | Body `StudentCreateInput`; creates User(role STUDENT, default pw `Student@123` if none)+Student; auto studentId `STU-2025-####` (max seq+1) if absent; unique email 400 |
| GET | /api/students/[id] | ADMIN, TEACHER, STUDENT(self), PARENT(own child) | `{ student: StudentDetailDTO }` |
| PUT | /api/students/[id] | ADMIN | Body `StudentUpdateInput`; updates User + Student fields |
| DELETE | /api/students/[id] | ADMIN | Soft delete → status INACTIVE (both user+student) |

### Teachers
| GET | /api/teachers?query&status | ADMIN, TEACHER | `{...TeacherListResponse}` (subjects incl. className, classes via TeacherClass) |
| POST | /api/teachers | ADMIN | `TeacherCreateInput`; default pw `Teacher@123`; auto teacherId `TCH-2025-####` |
| GET | /api/teachers/[id] | ADMIN, TEACHER | `{ teacher: TeacherDTO }` |
| PUT | /api/teachers/[id] | ADMIN | `TeacherUpdateInput` |
| DELETE | /api/teachers/[id] | ADMIN | Soft delete |
| GET | /api/teachers/me/classes | TEACHER | `{ classes: { id, name, studentCount, subjectCount }[] }` — classes where teacher teaches a subject OR is class teacher |

### Parents
| GET | /api/parents?query | ADMIN | `{...ParentListResponse}` (children incl. class/section names) |
| POST | /api/parents | ADMIN | `ParentCreateInput`; default pw `Parent@123` |
| GET | /api/parents/[id] | ADMIN | `{ parent: ParentDTO }` |
| PUT | /api/parents/[id] | ADMIN | `ParentUpdateInput` |
| DELETE | /api/parents/[id] | ADMIN | Soft delete (user.status=INACTIVE) |

### Classes / Sections / Subjects / Assignments
| GET | /api/classes | any logged-in | `{ classes: ClassDTO[] }` |
| POST | /api/classes | ADMIN | {name, academicYear} |
| PUT | /api/classes/[id] | ADMIN | {name?, academicYear?} |
| DELETE | /api/classes/[id] | ADMIN | hard delete (cascades) |
| POST | /api/classes/[id]/sections | ADMIN | {name} |
| DELETE | /api/sections/[id] | ADMIN | — |
| GET | /api/subjects?classId | any logged-in | `{ subjects: SubjectDTO[] }` |
| POST | /api/subjects | ADMIN | {name, code, classId, teacherId?} |
| PUT | /api/subjects/[id] | ADMIN | {name?, code?, teacherId?(null to unassign)} |
| DELETE | /api/subjects/[id] | ADMIN | — |
| POST | /api/classes/[id]/teachers | ADMIN | {teacherId} → TeacherClass |
| DELETE | /api/classes/[id]/teachers?teacherId= | ADMIN | remove TeacherClass |

### Attendance
| GET | /api/attendance?classId&date(YYYY-MM-DD) | TEACHER, ADMIN | `{...AttendanceRosterResponse}` — active students of class, status null if unmarked |
| POST | /api/attendance | TEACHER, ADMIN | {classId, date, records:[{studentId, status}]} → upsert (unique studentId+date), `{ saved: number }` |
| GET | /api/attendance/summary?studentId | ADMIN/TEACHER any; STUDENT self; PARENT own child | `{...AttendanceSummary}` (recent = last 30) |

### Exams & Results
| GET | /api/exams?classId | any logged-in | `{ exams: ExamDTO[] }` |
| POST | /api/exams | ADMIN | {name, classId, startDate, endDate} |
| PUT | /api/exams/[id] | ADMIN | {name?, startDate?, endDate?, status?} |
| DELETE | /api/exams/[id] | ADMIN | — |
| GET | /api/results?examId&subjectId | TEACHER, ADMIN | `{...MarksRosterResponse}` (active students of exam's class) |
| POST | /api/results | TEACHER, ADMIN | {examId, subjectId, marks:[{studentId, marks(0-100)}]} → upsert w/ grade+GPA calc; `{ saved: number }` |
| GET | /api/results/student?studentId&examId | ADMIN/TEACHER any; STUDENT self (studentId optional); PARENT own child | `{ sheet: StudentResultSheet }`; overallGrade = grade of average marks |

### Fees
| GET | /api/fees?studentId&status&type | ADMIN (any filters); STUDENT self; PARENT own children | `{...FeeListResponse}` incl. payments desc; summary computed; auto-set OVERDUE on read for past-due unpaid |
| POST | /api/fees | ADMIN | {studentId, title, type, amount, dueDate} |
| DELETE | /api/fees/[id] | ADMIN | — |
| POST | /api/fees/[id]/payments | ADMIN | {amount>0, method?, note?} → create Payment, update paidAmount + status (PAID if paid>=amount; PARTIAL if >0; OVERDUE if past due & unpaid; else PENDING) `{ fee: FeeDTO }` |

### Announcements
| GET | /api/announcements | any logged-in | role-filtered: ADMIN all; TEACHER ALL|TEACHERS + SPECIFIC_CLASS(classes they teach); STUDENT ALL|STUDENTS|SPECIFIC_CLASS(their class); PARENT ALL|PARENTS|SPECIFIC_CLASS(children's classes). Sorted newest first `{ announcements: AnnouncementDTO[] }` |
| POST | /api/announcements | ADMIN | {title, content, targetAudience, classId?} |
| DELETE | /api/announcements/[id] | ADMIN | — |

### Timetable
| GET | /api/timetable?classId | any logged-in | `{ entries: TimetableEntryDTO[] }` sorted day(THURSDAY?→ use order SUN..THU), period |
| POST | /api/timetable | ADMIN | {classId, day, period, startTime, endTime, subjectId, teacherId?} |
| DELETE | /api/timetable/[id] | ADMIN | — |

### Dashboard (single role-aware endpoint)
| GET | /api/dashboard | any logged-in | ADMIN→AdminDashboard, TEACHER→TeacherDashboard, STUDENT→StudentDashboard, PARENT→ParentDashboard (per types.ts) |

Notes:
- todayAttendancePct: PRESENT/(marked) for today across school.
- feeCollection chart: last 6 months from Payment.paidAt grouped by month (collected) + Fee due by month.
- attendanceTrend: last 7 school days pct.
- STUDENT dashboard attendanceThisMonth = current calendar month.
- FILE OWNERSHIP: 2-a owns `src/app/api/**`, `src/lib/auth.ts`, `src/lib/api-auth.ts`, `src/lib/api-utils.ts`, `src/lib/grade.ts`. 2-b owns `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**` (except ui/), `src/lib/client-api.ts`, `src/hooks/app-hooks.ts`, `src/store/app-store.ts`. 3-a owns `src/components/teacher/**` + `src/components/nav/nav-teacher.ts`. 3-b owns `src/components/student/**`, `src/components/parent/**`, `src/components/nav/nav-student.ts`, `src/components/nav/nav-parent.ts`.
---
Task ID: 2-a
Agent: full-stack-developer (backend)
Task: Implement all REST API routes per contract

Work Log:
- Read worklog.md contract, src/lib/types.ts DTOs, prisma/schema.prisma.
- Implemented/verified lib layer: auth.ts (jose HS256 sign/verify, cookie sms_token, 7d), api-auth.ts (requireAuth reads cookie, verifies, re-loads user, 401 bad/expired/missing, 403 INACTIVE or role not in list), api-utils.ts (ApiError, handle() wrapper, parseBody with Zod v4, q()/pagination/requireDay/dayRangeUTC UTC-midnight helpers, feeStatusFor, nextStudentCode/nextTeacherCode auto IDs STU/TCH-2025-####, DTO mappers for all entities, announcementWhereFor role-visibility filter), grade.ts (gradeFor/overallFor per BD SSC table).
- Implemented all route files under src/app/api/**: auth (login/logout/me/forgot-password/reset-password), students (list w/ query+classId+sectionId+status+pagination, create w/ transaction User+Student + default pw Student@123 + auto ID), students/[id] (GET role-scoped self/child, PUT admin, DELETE soft → INACTIVE both records), teachers (+[id], me/classes w/ studentCount+subjectCount), parents (+[id]), classes (+[id] PUT/DELETE hard, sections POST, teachers POST/DELETE), sections/[id] DELETE, subjects (+[id], teacherId null → unassign), attendance (GET roster w/ status null unmarked, POST upsert normalized to UTC midnight, transaction), attendance/summary (role-scoped: admin/teacher any, student self optional id, parent own child), exams (+[id]), results (GET marks roster, POST upsert w/ gradeFor calc), results/student (sheet w/ overallFor; student self optional id, parent own child only → 403), fees (GET role-scoped incl. summary + auto-OVERDUE recompute on read, POST), fees/[id] DELETE, fees/[id]/payments (POST → Payment + paidAmount + status recompute), announcements (GET role-filtered ALL/audience/SPECIFIC_CLASS, POST admin w/ classId required for SPECIFIC_CLASS), announcements/[id] DELETE, timetable (GET sorted SUN..THU→period, POST w/ slot-clash check), timetable/[id] DELETE, dashboard (single endpoint → AdminDashboard/TeacherDashboard/StudentDashboard/ParentDashboard exactly per types.ts, incl. gender & studentsByClass charts, 7-day attendanceTrend, 6-month feeCollection from Payment.paidAt + Fee.dueDate).
- Prisma unique-violation P2002 mapped to friendly 400 (email/studentId/teacherId/attendance); P2025 → 404; Zod issues → 400 with field path.
- Curl-verified end-to-end with cookie jars for 4 roles: login ok (401 bad creds, 403 INACTIVE), me x4, forgot/reset flow (dev token, min 6 chars, single-use), students list/filters/pagination/auto-ID/dup-email-400/detail/soft-delete, teachers CRUD + me/classes, parents CRUD w/ children embed, classes CRUD + sections + class-teacher assign/remove, subjects filter + assign/unassign, attendance roster + upsert re-POST (no dup, statuses updated) + summary per role, exams CRUD + date validation, results roster + upsert (85→A+/5.0, 45→B/3.0) + sheet (6 subjects, avg 76.3 → A/4.0) + role guards, fees per role (student self, parent children, teacher 403) + filters + payment 200→PARTIAL→PAID + auto-OVERDUE on read, announcements per-role visibility verified (SPECIFIC_CLASS visible to teacher of class & parent with child in class), timetable sort order verified, dashboards x4 roles payload-checked, unauth sweep 401 on all protected routes, no 500s in dev.log from API routes.

Stage Summary:
- ALL contract endpoints implemented and green. Response shapes match src/lib/types.ts DTOs; dates serialized via .toISOString(); attendance dates normalized to UTC midnight so [studentId,date] unique is stable; marks upsert on [studentId,examId,subjectId] with grade/GPA recompute.
- Deviations/notes: (1) Test data created during verification (API Test Student/Teacher/Parent + 2 fees) was soft-deleted/removed; logs may show these. (2) GET /api/classes/[id] has no GET handler (contract defines only PUT/DELETE) → Next returns 405; intentional. (3) GET / 500s in dev.log come from src/app/page.tsx placeholder (task 2-b domain), not from API routes. (4) Seed gives demo parent 4 children (Jubair, Ayesha, Nabila, Sumaiya) — noted by orchestrator worklog says "2 children"; backend only relies on real Parent-Student relations. (5) Fee with dueDate = today UTC-midnight counts as OVERDUE after 00:00 UTC (feeStatusFor: dueDate < now) — consistent with seed semantics.
- Demo accounts unchanged; default passwords Student@123 / Teacher@123 / Parent@123 work for created records.
---
Task ID: 2-b
Agent: full-stack-developer (frontend core + admin)
Task: App shell, login, shared components, admin views

Work Log:
- Core plumbing: `src/lib/client-api.ts` (ApiError{status}, request() relative-URL fetch wrapper, 401 → window CustomEvent "edusphere:unauthorized", api.{get,post,put,del}, toQuery builder); `src/hooks/use-auth.tsx` ('use client' AuthProvider owning TanStack QueryClient, GET /api/auth/me on mount, login/logout/refresh, 401-event listener drops to login); `src/store/app-store.ts` (zustand activeView/setActiveView); `src/app/page.tsx` (branded splash → LoginScreen → AppShell); `src/app/layout.tsx` (title "EduSphere — School Management System", ThemeProvider class/light, sonner Toaster top-right only).
- `src/app/globals.css`: emerald/teal theme — --primary oklch(0.55 0.13 165) light / 0.72 dark, --ring matched; chart-1..5 = emerald, amber, teal, orange, slate; `.scrollbar-thin` 6px scrollbars for tables/dialogs.
- `src/components/layout/app-shell.tsx`: responsive sidebar (fixed lg + Sheet mobile), role nav from nav-<role>.ts with string→lucide ICONS map (incl. spec icons BarChart3/GraduationCap/Briefcase/CalendarClock/FileText/UserRound), sticky header w/ page title + role Badge + user dropdown (logout) + dark-mode toggle (CSS dark: icon swap, no mounted state), framer-motion view transition, mt-auto sticky footer "© EduSphere SMS — Admin · Teacher · Student · Parent portal"; activeView validated per role, defaults to first nav key.
- Nav configs (exact keys for 3-a/3-b): nav-admin (10 keys), nav-teacher (6), nav-student (7, incl. student:profile), nav-parent (5).
- `src/components/auth/login-screen.tsx`: split brand panel (emerald gradient, 4 role feature bullets) + login card; react-hook-form+zod login, show/hide password, error Alert + sonner toast; inline 2-step forgot flow (POST /api/auth/forgot-password → shows dev {token,name} → POST /api/auth/reset-password → success screen); 4 demo-account quick-fill chips.
- Shared kit `src/components/shared/*`: StatCard (6 tones), PageHeader, StatusBadge (ACTIVE/PRESENT/PAID/COMPLETED green, INACTIVE/SCHEDULED slate, ABSENT/OVERDUE red, LATE/PENDING/ONGOING amber, LEAVE/PARTIAL orange), EmptyState, LoadingState (table/cards/detail/list) + LoadError retry, ConfirmDialog (alert-dialog, async pending), SearchInput (debounced 300ms), FormDialog, InitialAvatar, ScrollTable (max-h-[520px] overflow-auto scrollbar-thin), ComingSoon, format helpers (৳ currency, "dd MMM yyyy" dates, initials, titleCase); barrel `index.ts`.
- Admin views `src/components/admin/*` + registry `index.tsx` (adminViews: Record<string, ComponentType>): dashboard (5 StatCards + recharts AreaChart attendance trend, BarChart students-by-class, PieChart gender, grouped BarChart fee collection w/ month labels, recent announcements), students (debounced search + class/status filters, paginated table, RHF+zod add/edit dialog w/ class→section cascade from embedded ClassDTO.sections + parent Select, activate/deactivate ConfirmDialog, detail dialog w/ attendance/fee/GPA summary), teachers (table + add/edit + deactivate), parents (table w/ children chips + add/edit + deactivate), classes (card grid + add/edit/delete + manage dialog: sections add/remove, class-teacher assign/remove), subjects (class filter, add/edit incl. teacherId:null unassign, delete), timetable (class Select, SUN–THU × periods grid, add-entry dialog w/ per-class subject Select + time inputs, per-cell delete, horizontal scroll on mobile), exams (class filter, add/edit w/ date validation, delete, Results dialog fetching /api/results/student per active student of class ranked by GPA), fees (4 summary chips, student Command+Popover searchable picker, status/type filters, New fee dialog, Record payment dialog, payment history dialog, delete), announcements (card grid, compose dialog w/ audience + conditional class Select, delete).
- Placeholder bundles for later agents: `src/components/teacher/index.tsx` (teacherViews), `src/components/student/index.tsx` (studentViews), `src/components/parent/index.tsx` (parentViews) — ComingSoon cards; keys match nav files exactly.
- Lint/verify: eslint 0 errors on owned paths (2 acceptable react-hooks/incompatible-library warnings from RHF watch()); tsc --noEmit clean for owned files (fixed missing useQueryClient in classes/subjects, ConfirmDialog onConfirm → Promise<unknown>, StudentResultSheet.student has no rollNumber); curl smoke tests w/ cookie jars for all 4 roles — every endpoint shape matches src/lib/types.ts; GET / 200; dev.log clean for owned files.

Stage Summary:
- EXPORTS / REGISTRATION (3-a & 3-b): your bundle file must export `teacherViews` / `studentViews` / `parentViews` typed `Record<string, ComponentType>` (default-export-free). AppShell imports them from "@/components/teacher|student|parent" and looks up `views[current.key]`; if a key is missing from your map a ComingSoon placeholder renders — keep keys EXACTLY: teacher = teacher:dashboard, teacher:classes, teacher:attendance, teacher:marks, teacher:timetable, teacher:announcements; student = student:dashboard, student:attendance, student:results, student:fees, student:timetable, student:announcements, student:profile; parent = parent:dashboard, parent:children, parent:results, parent:fees, parent:announcements. Nav labels/icons live in `src/components/nav/nav-<role>.ts` (edit freely, keys must stay).
- useAuth pattern: `const { user, loading, login, logout, refresh } = useAuth()` — user: PublicUser|null (role via user.role); components render inside AppShell only when authed; every 'use client' view uses TanStack Query: `useQuery({ queryKey: [...], queryFn: () => api.get<T>("/api/...") })`, mutations via `useMutation` + `queryClient.invalidateQueries({ queryKey: [...] })`; queries share ["classes"] / ["subjects", {classId}] / ["announcements"] keys — invalidate those after writes.
- client API: `import { api, ApiError, toQuery } from "@/lib/client-api"` — `api.get<T>(path)`, `api.post/put<T>(path, body)`, `api.del(path)`; errors are ApiError with `.status` + server `{error}` message (toast `err.message`); 401 auto-logs-out via global event; build querystrings with `toQuery({ a, b })` (skips empty).
- Shared components: `import { PageHeader, StatCard, StatusBadge, EmptyState, LoadingState, LoadError, ConfirmDialog, SearchInput, FormDialog, InitialAvatar, ScrollTable, ComingSoon, formatCurrency, formatDate, formatDateTime, initials, titleCase } from "@/components/shared"` — wrap long tables in `<ScrollTable>`; StatCard tones: emerald/teal/amber/orange/rose/slate; StatusBadge covers ACTIVE/INACTIVE, PRESENT/ABSENT/LATE/LEAVE, PENDING/PARTIAL/PAID/OVERDUE, SCHEDULED/ONGOING/COMPLETED.
- Styling conventions: p-4 md:p-6 containers, gap-4/6, tables in rounded border + scrollbar-thin, currency `formatCurrency` (৳), dates "dd MMM yyyy", no blue/indigo anywhere — emerald is brand primary; dashboard charts use raw recharts imports with CSS var(--chart-1..5) fills.
- Note: admin login lands on admin:dashboard; switching role resets activeView to that role's first nav key (zustand store is global — no persistence beyond session).
---
Task ID: 3-b
Agent: full-stack-developer (student+parent views)
Task: Student and Parent role views

Work Log:
- Read worklog (contract + 2-a/2-b stage summaries), types.ts, client-api.ts, use-auth.tsx, app-shell.tsx, shared components, admin views; matched patterns exactly (api.get<T> + useQuery, shared kit, p-4 md:p-6, ৳ currency, no blue/indigo).
- Curl-verified every endpoint consumed, with cookie jars for both demo accounts: /api/dashboard (STUDENT + PARENT shapes), /api/attendance/summary (self + ?studentId=), /api/exams?classId, /api/results/student?examId (self) and ?studentId&examId (parent, incl. empty-results sheet), /api/fees (self + ?studentId), /api/announcements (role-filtered), /api/timetable?classId, /api/students/[id] (STUDENT self AND PARENT own child).
- KEY PAYLOAD FINDING: both StudentDashboard.student.id and ChildOverview.student.id ARE the DB ids → GET /api/students/[id] works directly (self / own child) and supplies class.id, full profile fields, attendanceSummary, feeSummary, gpa. No backend workaround needed.
- Built student bundle: use-student.ts (cached ["student","dashboard"] + ["student","detail",id] hooks), result-sheet.tsx (shared ResultSheet + GradeBadge w/ A+..F palette), fees-content.tsx (shared summary chips + fee cards + collapsible payment history + office hint), announcements-view.tsx (shared read-only role-filtered list), student-dashboard.tsx (gradient greeting + 4 StatCards + today classes + upcoming exams + recent results + announcements), attendance-view.tsx (SVG progress ring, recharts present-vs-absent by weekday from last-30 records, 4 status StatCards, recent records table), results-view.tsx (exam Select auto-prefers newest exam w/ resultCount>0 → ResultSheet; empty sheet → "Results not published yet" EmptyState), fees-view.tsx (self fees), timetable-view.tsx (today card from dashboard.todaySchedule + SUN–THU × periods week grid, today column highlighted, horizontal scroll on mobile), student-profile.tsx (identity card w/ avatar + 8 info fields + attendance/GPA/fees snapshot cards).
- Built parent bundle: use-parent.ts (["parent","dashboard"]), selection.ts (module-scope resultsChildId handoff), parent-dashboard.tsx (per-child overview cards w/ attendance Progress + GPA + recentGrade + pending fees, announcements list), children-view.tsx (richer cards + "View results" → sets parentSelection + setActiveView("parent:results")), results-view.tsx (child Select + exam Select chained via /api/students/[childId] → class.id → /api/exams?classId → /api/results/student, same ResultSheet, empty/unpublished handling), fees-view.tsx (child Select + FeesContent studentId), announcements-view.tsx (wrapper over shared AnnouncementsView).
- Registries: student/index.tsx + parent/index.tsx export studentViews/parentViews Record<string, ComponentType> with exact nav keys. Nav tweak: parent:children icon Users → UsersRound (keys untouched).
- Verify: bunx eslint on owned paths → 0 errors 0 warnings; bunx tsc --noEmit filtered to owned paths → 0 type errors; dev.log contains NO errors from student/**, parent/**, nav-student.ts, nav-parent.ts.

Stage Summary:
- All 12 view keys implemented and registered: student:dashboard/attendance/results/fees/timetable/announcements/profile, parent:dashboard/children/results/fees/announcements. AppShell picks them up automatically.
- Shared pieces live in src/components/student/ (ResultSheet, GradeBadge, FeesContent, AnnouncementsView) and are imported by parent views — both folders owned by 3-b, so no ownership violation; presentational reuse, data-fetching stays per-view.
- Payload observations: StudentResultSheet empty case returns results:[] + overallGrade "F" → handled as "Results not published yet" (footer stats only render when results exist). Attendance recent dates are UTC-midnight normalized → weekday chart reads weekday in timeZone:"UTC". GPA is number|null in dashboards → rendered via toFixed(2) or "—". Exams list may be SCHEDULED (resultCount 0) → default exam selection prefers newest with resultCount>0. Seed gives demo parent 4 children (not 2) — all UI is data-driven.
- Student fees & parent fees are read-only by design: no payment action, "contact the school office" hint (payments are office/admin-recorded).
- DEVIATION/NONE-BLOCKING: GET / returned 500 during verification — caused solely by src/components/teacher/timetable.tsx (Task 3-a agent) importing Badge from @/components/shared (not an export there) + missing ./preselect module. Not owned by 3-b, left untouched; student/parent modules compile clean in isolation (eslint + tsc proof above).

---
Task ID: 3-a
Agent: full-stack-developer (teacher views)
Task: Teacher role views

Work Log:
- Read worklog (Task 1 contract, 2-a backend notes, 2-b Stage Summary patterns), types.ts, client-api.ts, use-auth, app-shell, nav-teacher, shared kit, admin views (dashboard/timetable/announcements/exams) as pattern reference.
- Curl-verified every endpoint with a teacher cookie jar BEFORE coding: /api/dashboard (TeacherDashboard: stats{classes:5,students:12,todayClasses:2,pendingAttendance:3}, myClasses, upcomingExams, todaySchedule, announcements), /api/teachers/me/classes, /api/attendance?classId&date (roster w/ null statuses + markedCount), POST /api/attendance → {saved}, /api/exams?classId, /api/results?examId&subjectId (MarksRoster w/ marks+enteredCount), POST /api/results → {saved}, /api/timetable?classId (SUN-THU entries w/ subject+teacher), /api/announcements (role-filtered: ALL+TEACHERS+SPECIFIC_CLASS for demo teacher), /api/students?classId (incl. INACTIVE rows), /api/subjects?classId.
- Replaced placeholder bundle. Files (all 'use client', strict TS, react-query + sonner + lucide, shared kit reuse): index.tsx (teacherViews registry, 6 exact keys), dashboard.tsx, classes.tsx, attendance.tsx, marks.tsx, timetable.tsx, announcements.tsx, common.ts (formatTime/formatDay (local-safe YYYY-MM-DD)/todayISO (UTC, matches backend day normalization)/AUDIENCE_STYLES/MyClass type).
- Preselection hand-off: appended `attendancePreselect`/`marksPreselect`/`classesPreselect: string | null` fields to src/store/app-store.ts (existing fields untouched) — quick actions do useAppStore.setState({...}) then setActiveView; target views read once via useAppStore.getState() in useState initializers (StrictMode-safe, values overwritten by next quick action). An earlier module-scope mutable object was rejected by the new react-hooks/immutability rule, hence the zustand route.
- Draft state design: unsaved edits are an OVERLAY on the server roster keyed by "classId|date" (attendance) / "examId|subjectId" (marks) — no setState-in-effect (new react-hooks/set-state-in-effect rule), key mismatch silently drops stale edits; counts/stats are plain derivations (React Compiler handles memoization; hand-written useMemo over derived arrays broke react-hooks/preserve-manual-memoization).
- Dashboard: 4 StatCards (My Classes, Total Students, Today's Classes, Pending Attendance orange), my-classes card grid w/ Attendance/Marks/Details quick actions, today's schedule list (period chip, subject, class, time), upcoming exams w/ StatusBadge, recent announcements.
- Classes: card grid (ring highlight on selected, aria-pressed) + details (lg:col-span-3 students ScrollTable: roll/name+studentId/email/StatusBadge; lg:col-span-2 subjects list w/ teacher names + emerald "Me" badge via useAuth user.id) + per-card "Take attendance"/"Enter marks".
- Attendance: class+date filters (Input type=date default today, "Today" reset), "Editing existing attendance" amber banner when markedCount>0, roster w/ per-row status Select (colored icons: PRESENT emerald CheckCircle2, ABSENT rose XCircle, LATE amber Clock, LEAVE orange CalendarOff, placeholder "Not marked"), Mark-all-present/Clear bulk, summary chips (present/absent/late/leave/unmarked) in sticky bottom-4 save bar, partial-safe POST (only set statuses sent; button disabled at 0 marked), empty-class EmptyState, success toast "N students marked" + invalidate teacher attendance/dashboard.
- Marks: class→exam→subject cascade (subject options = subjects assigned to ME, amber notice + fallback to all when none), number inputs 0-100 w/ rose invalid highlight + aria-invalid, chips: entered x/total, invalid count, average (Σ), sticky save bar, POST only valid non-empty marks, toast "N results saved" + invalidate marks/exams/dashboard.
- Timetable: read-only SUN-THU × periods grid, my cells emerald + "me" badge (entry.teacher.id === user.id), others muted, period time column, legend, horizontal scroll min-w-[760px].
- Announcements: read-only card grid (audience badges incl. SPECIFIC_CLASS → "Class X", date, full content, publishedBy), empty state.
- Verify: eslint 0 problems on src/components/teacher + nav-teacher.ts (+ app-store.ts); tsc --noEmit clean for owned files; curl smoke: GET / 200, POST /api/attendance → {"saved":3} and POST /api/results → {"saved":1} (idempotent re-POST of existing values, seed data untouched); dev.log clean for teacher files (earlier transient ⨯ entries were mid-edit states: removed ./preselect import, stray brace, Badge re-export — all fixed).

Stage Summary:
- All 6 teacher views shipped and registered: teacher:dashboard, teacher:classes, teacher:attendance, teacher:marks, teacher:timetable, teacher:announcements (keys match nav-teacher.ts exactly; nav file unchanged — labels/icons already right).
- Patterns for future agents: query keys shared per 2-b convention (["classes"-style] → here ["teacher","my-classes"], ["subjects",{classId}], ["exams",{classId}], ["timetable",{classId}], ["announcements"], plus ["teacher", ...] namespace); after attendance/results writes invalidate ["teacher","dashboard"] so teacher stat cards stay fresh.
- Endpoint observations: (1) attendance date is UTC-normalized — client sends "YYYY-MM-DD" from toISOString (UTC today) so it matches dashboard "today" semantics; formatDay() parses bare YYYY-MM-DD as LOCAL date to avoid display drift. (2) /api/students?classId includes INACTIVE students (Grade 9: 5 listed vs 4 in attendance roster) — classes view shows a Status column deliberately. (3) Demo teacher Mahmudul Hasan teaches Mathematics in Grades 9+10 (mySubjects filter verified against /api/subjects teacher.id). (4) POST /api/attendance and /api/results are upserts returning {saved}; partial records payloads accepted (only marked/entered rows sent). (5) app-store.ts gained 3 nullable preselect fields (Task 3-a, appended per instructions) — safe for other roles to ignore.

---
Task ID: 4
Agent: Z.ai Code (orchestrator)
Task: Integration, lint, E2E browser verification, cleanup, final report.

Work Log:
- Global `bun run lint`: 0 errors, 2 benign warnings (react-hooks/incompatible-library from RHF watch() in admin exams/students — known harmless).
- dev.log sweep: no 500s/crashes from app routes; only expected 401s during login transitions; all APIs returning 200.
- Data cleanup: hard-deleted leftover "API Test Student STU-2025-0013" (INACTIVE) created during 2-a curl testing → student count back to 12.
- Agent Browser E2E verification (all flows exercised in real browser):
  - Login screen renders (split brand panel, 4 demo quick-fill chips, forgot/reset flow). Admin login → dashboard with 5 KPIs (12 students, 6 teachers, 5 classes, 75% attendance, ৳27,100 pending) + 4 recharts (attendance trend, students by class, gender pie, fee collection) + recent announcements.
  - Admin Students table w/ search/filters/pagination/status badges; Classes card grid (sections, subjects, class teachers, Manage/Edit/Delete).
  - FULL WRITE FLOW: composed + published announcement via dialog (toast "Announcement published", appeared in list, then deleted via API — cleanup confirmed).
  - Teacher: dashboard (5 classes, 12 students, today schedule, pending attendance), Attendance flow verified end-to-end (Grade 10 roster → "editing existing" banner → Mark all present → Save → toast "Attendance saved — 5 students marked"), Marks entry view (per-subject roster w/ validation).
  - Student (Jubair): dashboard (80% attendance, GPA 4.00, fees, upcoming exams), My Results (Mid Term sheet: 6 subjects, total/avg/GPA/grade), My Fees (outstanding ৳2,100, Partial + Overdue cards, payment history).
  - Parent (Siddique): Family Overview with 4 children cards (attendance/GPA/recent grade/pending fees each), Results view with child switcher (Jubair GPA 4.00-A → Ayesha GPA 3.00-B, correctly scoped).
  - Timetable: weekly SUN–THU × P1–P6 grid per class with subject+teacher cells (admin add/delete affordances).
  - Dark mode toggle verified (emerald palette holds). Mobile 390px: hamburger → Sheet drawer (10 items), stat cards stack, tables scroll.
- Note: earlier "chip click doesn't fill form" and "nav click doesn't navigate" observations were test-tooling stale-element races after React remounts (Playwright pinned refs / pre-hydration clicks) — confirmed app works correctly via full pointer-event dispatch and in clean sessions.

Stage Summary:
- PRODUCTION-READY MVP. All 4 roles verified in-browser. Server on port 3000 green, lint green (0 errors), 12 students/6 teachers/3 parents/5 classes seeded with full academic data.
- Demo logins: admin@edusphere.test/Admin@123 · teacher@edusphere.test/Teacher@123 · student@edusphere.test/Student@123 · parent@edusphere.test/Parent@123
