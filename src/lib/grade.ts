/**
 * EduSphere — BD SSC-style grading (shared semantics with prisma/seed.ts).
 *   >=80 A+/5.0, >=70 A/4.0, >=60 A-/3.5, >=50 B/3.0, >=40 C/2.0, >=33 D/1.0, else F/0.0
 */

export function gradeFor(marks: number): { grade: string; gpa: number } {
  if (marks >= 80) return { grade: "A+", gpa: 5.0 };
  if (marks >= 70) return { grade: "A", gpa: 4.0 };
  if (marks >= 60) return { grade: "A-", gpa: 3.5 };
  if (marks >= 50) return { grade: "B", gpa: 3.0 };
  if (marks >= 40) return { grade: "C", gpa: 2.0 };
  if (marks >= 33) return { grade: "D", gpa: 1.0 };
  return { grade: "F", gpa: 0.0 };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Aggregate an overall result from a list of marks.
 * Per API contract: overallGrade = grade of the average marks.
 */
export function overallFor(
  marksList: number[]
): { total: number; average: number; gpa: number; overallGrade: string } {
  const count = marksList.length;
  const total = marksList.reduce((sum, m) => sum + m, 0);
  const average = count > 0 ? total / count : 0;
  const { grade, gpa } = gradeFor(average);
  return {
    total: round1(total),
    average: round1(average),
    gpa: round2(gpa),
    overallGrade: grade,
  };
}
