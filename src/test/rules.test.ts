import { describe, expect, it } from "vitest";
import { warningLevel, teachingLoad, isSessionLocked } from "@/lib/academic";
import { canCreateRole, canManageUser, canAccess } from "@/lib/roles";

describe("absence warnings", () => {
  it("below 3% is clear", () => expect(warningLevel(2.9)).toBe("none"));
  it("3% is a notice", () => expect(warningLevel(3)).toBe("notice"));
  it("5% is a first warning", () => expect(warningLevel(5)).toBe("first"));
  it("7% is a final warning", () => expect(warningLevel(7)).toBe("final"));
  it("10% bars from exam", () => expect(warningLevel(10)).toBe("barred"));
});

describe("attendance edit lock", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("editable within 7 days", () => expect(isSessionLocked("2026-10-07T12:00:00Z", now)).toBe(false));
  it("locked after 7 days", () => expect(isSessionLocked("2026-10-06T11:00:00Z", now)).toBe(true));
});

describe("teaching load", () => {
  it("lecturer quota is 14h and flags over-load", () => {
    const slots = Array.from({ length: 8 }, () => ({
      period_start: "08:00",
      period_end: "10:00",
      session_type: "theory" as const,
    }));
    const r = teachingLoad(slots, "lecturer");
    expect(r.quota).toBe(14);
    expect(r.total).toBe(16);
    expect(r.status).toBe("over");
  });
});

describe("account creation", () => {
  it("only system admin creates university admins", () => {
    expect(canCreateRole("system_admin", "super_admin")).toBe(true);
    expect(canCreateRole("super_admin", "super_admin")).toBe(false);
  });
  it("college admin creates only instructors and students", () => {
    expect(canCreateRole("college_admin", "instructor")).toBe(true);
    expect(canCreateRole("college_admin", "student")).toBe(true);
    expect(canCreateRole("college_admin", "registrar")).toBe(false);
  });
  it("department admin cannot create accounts", () => {
    expect(canCreateRole("dept_admin", "student")).toBe(false);
  });
  it("college admin cannot manage users of another college", () => {
    expect(
      canManageUser(
        { id: "a", role: "college_admin", college_id: "c1" },
        { id: "b", role: "student", college_id: "c2" },
      ),
    ).toBe(false);
  });
});

describe("feature access", () => {
  it("students never see account management", () => expect(canAccess("student", "users")).toBe(false));
  it("disabled feature hides for non-system roles", () =>
    expect(canAccess("instructor", "library", new Set(["library"]))).toBe(false));
});

import { shiftHours, lectureEnd, remainingCourseHours, canChangeOwnPassword } from "@/lib/academic";
describe("timetable shifts", () => {
  it("morning runs 8:30 to 14:30", () => {
    expect(shiftHours("morning")).toEqual(["08:30", "09:30", "10:30", "11:30", "12:30", "13:30"]);
  });
  it("evening runs 14:30 to 20:30", () => {
    expect(shiftHours("evening")[0]).toBe("14:30");
    expect(lectureEnd("evening", "18:30", 2)).toBe("20:30");
    expect(lectureEnd("evening", "19:30", 2)).toBeNull();
  });
  it("reports remaining course hours", () => {
    const r = remainingCourseHours({ theoretical_hours: 4, practical_hours: 2 }, "theory", [{ period_start: "08:30", period_end: "10:30" }]);
    expect(r.remaining).toBe(2);
  });
  it("only admins and registrar change own password", () => {
    expect(canChangeOwnPassword("registrar")).toBe(true);
    expect(canChangeOwnPassword("student")).toBe(false);
    expect(canChangeOwnPassword("instructor")).toBe(false);
  });
});
