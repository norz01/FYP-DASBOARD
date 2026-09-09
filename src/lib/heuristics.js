/**
 * Calculates the general employability percentage for students.
 * Formula: (CGPA / 4) * 40 + Attendance * 0.6
 * Used in the Student Dashboard.
 */
export const calculateEmployability = (cgpa, attendance) => {
  const score = (Number(cgpa) / 4) * 40 + Number(attendance) * 0.6;
  return Math.min(100, Math.round(score));
};

/**
 * Calculates the score for top performers.
 * Formula: (CGPA / 4) * 60 + Attendance * 0.4
 * Used in the Staff Dashboard "Top Performers" section.
 */
export const calculateTopPerformerScore = (cgpa, attendance) => {
  const score = (Number(cgpa) / 4) * 60 + Number(attendance) * 0.4;
  return Math.min(100, Math.round(score));
};