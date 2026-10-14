// Pure academic rules: absence warnings, teaching load, timetable helpers.
import { RANK_QUOTA, type AcademicRank } from "./roles";

export type WarningLevel = "none" | "notice" | "first" | "final" | "barred";

export const WARNING_LABELS: Record<WarningLevel, string> = {
  none: "سليم",
  notice: "تنبيه",
  first: "إنذار أولي",
  final: "إنذار نهائي",
  barred: "ترقين قيد / فصل من المادة",
};

export const WARNING_THRESHOLDS: { level: Exclude<WarningLevel, "none">; pct: number }[] = [
  { level: "barred", pct: 10 },
  { level: "final", pct: 7 },
  { level: "first", pct: 5 },
  { level: "notice", pct: 3 },
];

/** Map an absence percentage (of the course's ministry hours) to its warning level. */
export function warningLevel(pct: number): WarningLevel {
  for (const t of WARNING_THRESHOLDS) if (pct >= t.pct) return t.level;
  return "none";
}

export const WARNING_BADGE: Record<WarningLevel, "success" | "notice" | "warning" | "danger" | "barred"> = {
  none: "success",
  notice: "notice",
  first: "warning",
  final: "danger",
  barred: "barred",
};

/** Total ministry hours for a course over the semester. */
export function courseTotalHours(c: { theoretical_hours: number; practical_hours: number; semester_weeks: number }) {
  return Math.max((Number(c.theoretical_hours) + Number(c.practical_hours)) * Number(c.semester_weeks), 1);
}

export function timeToMinutes(t: string): number {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function slotHours(start: string, end: string): number {
  return Math.round(((timeToMinutes(end) - timeToMinutes(start)) / 60) * 100) / 100;
}

export type LoadStatus = "under" | "ok" | "over";

export function teachingLoad(
  slots: { period_start: string; period_end: string; session_type: "theory" | "practical" }[],
  rank: AcademicRank | null | undefined,
) {
  let theory = 0;
  let practical = 0;
  for (const s of slots) {
    const h = slotHours(s.period_start, s.period_end);
    if (s.session_type === "practical") practical += h;
    else theory += h;
  }
  const total = Math.round((theory + practical) * 100) / 100;
  const quota = rank ? RANK_QUOTA[rank] : null;
  let status: LoadStatus | null = null;
  if (quota != null) status = total < quota ? "under" : total > quota ? "over" : "ok";
  return { theory, practical, total, quota, status };
}

// Iraqi academic week: Saturday..Thursday (JS getDay: 6,0,1,2,3,4)
export const WEEK_DAYS: { value: number; label: string }[] = [
  { value: 6, label: "السبت" },
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
];
export const DAY_LABEL: Record<number, string> = {
  0: "الأحد",
  1: "الاثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  general: "عامة",
  specialized: "تخصصية",
  supportive: "مساندة",
  core: "أساسية",
};

export const STATUS_LABELS: Record<string, string> = { present: "حاضر", absent: "غائب", excused: "مُجاز" };

/** Is an attendance session past the 7-day edit window? */
export function isSessionLocked(submittedAt: string | Date, now: Date = new Date()): boolean {
  const t = new Date(submittedAt).getTime();
  return now.getTime() - t > 7 * 24 * 60 * 60 * 1000;
}

/** A student matches a timetable slot if section/sub-group are unset on either side or equal. */
export function studentMatchesSlot(
  st: { department_id: string | null; stage: number | null; section: string | null; sub_group: string | null },
  slot: { department_id: string; stage: number; section: string | null; sub_group: string | null },
) {
  if (st.department_id !== slot.department_id || st.stage !== slot.stage) return false;
  if (slot.section && st.section && slot.section !== st.section) return false;
  if (slot.sub_group && st.sub_group && slot.sub_group !== st.sub_group) return false;
  return true;
}

export function todayISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

// ---------- Timetable shifts ----------
export type Shift = "morning" | "evening";
export const SHIFTS: Record<Shift, { label: string; start: string; end: string }> = {
  morning: { label: "صباحي", start: "08:30", end: "14:30" },
  evening: { label: "مسائي", start: "14:30", end: "20:30" },
};

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Hourly start times inside a shift, e.g. morning → 08:30 … 13:30. */
export function shiftHours(shift: Shift): string[] {
  const s = timeToMinutes(SHIFTS[shift].start);
  const e = timeToMinutes(SHIFTS[shift].end);
  const out: string[] = [];
  for (let m = s; m < e; m += 60) out.push(minutesToTime(m));
  return out;
}

/** End time for a lecture of `hours` starting at `start`, or null if it overflows the shift. */
export function lectureEnd(shift: Shift, start: string, hours: number): string | null {
  const end = timeToMinutes(start) + Math.round(hours * 60);
  if (timeToMinutes(start) < timeToMinutes(SHIFTS[shift].start) || end > timeToMinutes(SHIFTS[shift].end)) return null;
  return minutesToTime(end);
}

/** Weekly hours still unscheduled for a course's theory or practical part. */
export function remainingCourseHours(
  course: { theoretical_hours: number; practical_hours: number },
  type: "theory" | "practical",
  scheduled: { period_start: string; period_end: string }[],
): { required: number; scheduled: number; remaining: number } {
  const required = Number(type === "practical" ? course.practical_hours : course.theoretical_hours) || 0;
  const done = Math.round(scheduled.reduce((a, s) => a + slotHours(s.period_start, s.period_end), 0) * 100) / 100;
  return { required, scheduled: done, remaining: Math.round((required - done) * 100) / 100 };
}

export const STUDY_SYSTEMS: Record<string, string> = {
  bologna: "نظام بولونيا (ECTS)",
  courses: "النظام الفصلي (الكورسات)",
  annual: "النظام السنوي",
};
export const SHIFT_LABELS: Record<string, string> = { morning: "صباحي", evening: "مسائي", both: "صباحي ومسائي" };
export const DEGREE_LABELS: Record<string, string> = {
  diploma: "دبلوم",
  bachelor: "بكالوريوس",
  higher_diploma: "دبلوم عالٍ",
  master: "ماجستير",
  phd: "دكتوراه",
};
export const HALL_TYPES: Record<string, string> = { classroom: "قاعة دراسية", lab: "مختبر", theater: "مدرج", workshop: "ورشة" };

/** Only administrators and registration staff may change their own password. */
export function canChangeOwnPassword(role: string | null | undefined): boolean {
  return !!role && ["system_admin", "super_admin", "college_admin", "dept_admin", "registrar"].includes(role);
}
