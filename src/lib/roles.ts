// Pure role/permission rules shared by client and server. Keep free of imports with side effects.

export type AppRole =
  | "system_admin"
  | "super_admin"
  | "college_admin"
  | "dept_admin"
  | "instructor"
  | "student"
  | "registrar";

export type AcademicRank = "professor" | "assistant_professor" | "lecturer" | "assistant_lecturer";

export const ROLE_LABELS: Record<AppRole, string> = {
  system_admin: "ادمن النظام",
  super_admin: "ادمن الجامعة",
  college_admin: "ادمن كلية",
  dept_admin: "ادمن قسم",
  instructor: "تدريسي",
  student: "طالب",
  registrar: "موظف تسجيل",
};

export const ALL_ROLES: AppRole[] = [
  "system_admin",
  "super_admin",
  "college_admin",
  "dept_admin",
  "instructor",
  "student",
  "registrar",
];

export const RANK_LABELS: Record<AcademicRank, string> = {
  professor: "أستاذ",
  assistant_professor: "أستاذ مساعد",
  lecturer: "مدرس",
  assistant_lecturer: "مدرس مساعد",
};

/** Weekly statutory teaching load (hours) per academic rank. */
export const RANK_QUOTA: Record<AcademicRank, number> = {
  professor: 10,
  assistant_professor: 12,
  lecturer: 14,
  assistant_lecturer: 16,
};

export const ROLE_PREFIX: Record<AppRole, string> = {
  system_admin: "sys",
  super_admin: "ua",
  college_admin: "ca",
  dept_admin: "da",
  instructor: "in",
  student: "st",
  registrar: "rg",
};

/** Which roles each role may create accounts for. */
export const CREATABLE_ROLES: Record<AppRole, AppRole[]> = {
  system_admin: ["super_admin", "college_admin", "dept_admin", "registrar", "instructor", "student"],
  super_admin: ["college_admin", "dept_admin", "registrar", "instructor", "student"],
  college_admin: ["instructor", "student"],
  registrar: ["student"],
  dept_admin: [],
  instructor: [],
  student: [],
};

export function canCreateRole(caller: AppRole | null | undefined, target: AppRole): boolean {
  if (!caller) return false;
  return CREATABLE_ROLES[caller].includes(target);
}

/** Roles that are scoped to (and forced into) their own college when creating/managing users. */
export function isCollegeScoped(role: AppRole): boolean {
  return role === "college_admin" || role === "registrar";
}

export function canManageUser(
  caller: { role: AppRole | null; college_id: string | null; id: string },
  target: { role: AppRole | null; college_id: string | null; id: string },
): boolean {
  if (!caller.role || caller.id === target.id) return false;
  if (!target.role) return caller.role === "system_admin" || caller.role === "super_admin";
  if (!canCreateRole(caller.role, target.role)) return false;
  if (isCollegeScoped(caller.role)) {
    return !!caller.college_id && caller.college_id === target.college_id;
  }
  return true;
}

// ---------- Features & navigation ----------
export type Feature =
  | "dashboard"
  | "users"
  | "structure"
  | "courses"
  | "timetable"
  | "attendance"
  | "warnings"
  | "lectures"
  | "library"
  | "messages"
  | "workload"
  | "reports"
  | "permissions"
  | "logs";

export const FEATURE_LABELS: Record<Feature, string> = {
  dashboard: "لوحة التحكم",
  users: "إدارة الحسابات",
  structure: "الكليات والأقسام",
  courses: "المواد الدراسية",
  timetable: "الجدول الدراسي",
  attendance: "تسجيل الحضور",
  warnings: "الإنذارات",
  lectures: "المحاضرات",
  library: "المكتبة المركزية",
  messages: "المراسلات",
  workload: "النصاب التدريسي",
  reports: "القوائم الرسمية",
  permissions: "الصلاحيات",
  logs: "سجل النظام",
};

const ADMINS: AppRole[] = ["system_admin", "super_admin", "college_admin"];

/** Base access: which roles a feature can ever apply to. Super admin toggles narrow it further. */
export const FEATURE_ROLES: Record<Feature, AppRole[]> = {
  dashboard: ALL_ROLES,
  users: [...ADMINS, "registrar"],
  structure: ADMINS,
  courses: ALL_ROLES,
  timetable: ALL_ROLES,
  attendance: [...ADMINS, "dept_admin", "instructor", "registrar"],
  warnings: [...ADMINS, "dept_admin", "instructor", "registrar", "student"],
  lectures: ALL_ROLES,
  library: ALL_ROLES,
  messages: ALL_ROLES,
  workload: [...ADMINS, "dept_admin", "instructor"],
  reports: [...ADMINS, "dept_admin", "registrar", "instructor"],
  permissions: ["system_admin", "super_admin"],
  logs: ["system_admin", "super_admin"],
};

/** Features the super admin can toggle per role (permissions/logs are fixed). */
export const TOGGLEABLE_FEATURES: Feature[] = [
  "dashboard",
  "users",
  "structure",
  "courses",
  "timetable",
  "attendance",
  "warnings",
  "lectures",
  "library",
  "messages",
  "workload",
  "reports",
];

export function canAccess(
  role: AppRole | null | undefined,
  feature: Feature,
  disabled: Set<string> = new Set(),
): boolean {
  if (!role) return false;
  if (!FEATURE_ROLES[feature].includes(role)) return false;
  if (role === "system_admin") return true;
  if (TOGGLEABLE_FEATURES.includes(feature) && disabled.has(feature)) return false;
  return true;
}

export const TOP_ADMINS: AppRole[] = ["system_admin", "super_admin"];
export const isTopAdmin = (r: AppRole | null | undefined) => !!r && TOP_ADMINS.includes(r);
export const canEditStructure = (r: AppRole | null | undefined) =>
  !!r && ["system_admin", "super_admin", "college_admin", "dept_admin"].includes(r);
