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
