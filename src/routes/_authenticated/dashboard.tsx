import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, BookOpen, Building2, CalendarDays, ClipboardCheck, FileText, GraduationCap, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useAbsenceReport, useColleges, useCourses, useDepartments, useSlots, useUsers, nameMap } from "@/lib/data";
import { warningLevel, WARNING_BADGE, WARNING_LABELS, DAY_LABEL, studentMatchesSlot, teachingLoad } from "@/lib/academic";
import { ROLE_LABELS, RANK_LABELS } from "@/lib/roles";
import { PageHeader, Panel, StatCard, Empty } from "@/components/app/kit";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("لوحة التحكم", "ملخص الأداء الأكاديمي حسب صلاحيتك."),
  component: Dashboard,
});

function Dashboard() {
  const { me } = useMe();
  const role = me?.role;
  if (role === "student") return <StudentDash />;
  if (role === "instructor") return <InstructorDash />;
  return <AdminDash />;
}

function useWarnings() {
  const { data: report = [] } = useAbsenceReport();
  return report
    .map((r) => ({ ...r, level: warningLevel(Number(r.absence_pct ?? 0)) }))
    .filter((r) => r.level !== "none")
    .sort((a, b) => Number(b.absence_pct) - Number(a.absence_pct));
}

function AdminDash() {
  const { me } = useMe();
  const { data: users = [] } = useUsers();
  const { data: courses = [] } = useCourses();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const warnings = useWarnings();
  const { data: rate } = useQuery({
    queryKey: ["attendance_rate"],
    queryFn: async () => {
      const { data } = await supabase.from("attendance_records").select("status").limit(10000);
      const all = data ?? [];
      const present = all.filter((r) => r.status !== "absent").length;
      return all.length ? Math.round((present / all.length) * 100) : null;
    },
  });
  const p = me!.profile;
  const scope = useMemo(() => {
    if (me?.role === "college_admin" || me?.role === "registrar") return users.filter((u) => u.college_id === p.college_id);
    if (me?.role === "dept_admin") return users.filter((u) => u.department_id === p.department_id);
    return users;
  }, [users, me, p]);
  const students = scope.filter((u) => u.role === "student");
  const staff = scope.filter((u) => u.role === "instructor");
  const deptName = nameMap(depts);

  const byCollege = colleges
    .filter((c) => me?.role === "system_admin" || me?.role === "super_admin" || c.id === p.college_id)
    .map((c) => ({ c, n: students.filter((s) => s.college_id === c.id).length, d: depts.filter((d) => d.college_id === c.id).length }));

  const stageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) {
      const k = `${deptName.get(s.department_id ?? "") ?? "بدون قسم"} — المرحلة ${s.stage ?? "؟"}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort();
  }, [students, deptName]);

  return (
    <div>
      <PageHeader title={`مرحباً، ${p.full_name}`} description={me?.role ? ROLE_LABELS[me.role] : ""} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="الطلبة" value={students.length} icon={GraduationCap} />
        <StatCard label="التدريسيون" value={staff.length} icon={Users} tone="brass" />
        <StatCard label="المواد الفعّالة" value={courses.length} icon={BookOpen} tone="success" />
        <StatCard label="نسبة الحضور" value={rate == null ? "—" : `${rate}%`} icon={ClipboardCheck} tone="primary" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="تنبيهات الغياب" className="lg:col-span-2" actions={<Link to="/warnings" className="text-sm font-semibold text-primary">عرض الكل</Link>}>
          {warnings.length === 0 ? (
            <Empty icon={AlertTriangle} text="لا توجد إنذارات حالياً" />
          ) : (
            <ul className="divide-y">
              {warnings.slice(0, 8).map((w) => (
                <li key={`${w.student_id}-${w.course_id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-foreground">{w.full_name}</div>
                    <div className="text-xs text-muted-foreground">{w.course_name} · {w.absence_pct}%</div>
                  </div>
                  <Badge variant={WARNING_BADGE[w.level]}>{WARNING_LABELS[w.level]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {me?.role === "registrar" || me?.role === "dept_admin" ? (
          <Panel title="الطلبة حسب القسم والمرحلة">
            {stageCounts.length === 0 ? <Empty icon={GraduationCap} text="لا يوجد طلبة" /> : (
              <ul className="space-y-2 text-sm">
                {stageCounts.map(([k, n]) => (
                  <li key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><b className="text-foreground">{n}</b></li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title="الكليات">
            {byCollege.length === 0 ? <Empty icon={Building2} text="لم تُضف كليات بعد" /> : (
              <ul className="space-y-3">
                {byCollege.map(({ c, n, d }) => (
                  <li key={c.id} className="rounded-lg border p-3">
                    <div className="font-semibold text-foreground">{c.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{d} أقسام · {n} طالب</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function InstructorDash() {
  const { me } = useMe();
  const { data: slots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: users = [] } = useUsers();
  const { data: notices = [] } = useQuery({
    queryKey: ["inbox_recent"],
    queryFn: async () => (await supabase.from("messages").select("*").eq("receiver_id", me!.profile.id).order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
  const mine = slots.filter((s) => s.instructor_id === me!.profile.id);
  const today = new Date().getDay();
  const todays = mine.filter((s) => s.day_of_week === today);
  const courseName = nameMap(courses);
  const load = teachingLoad(mine, me!.profile.academic_rank);
  const studentCount = users.filter((u) => u.role === "student" && mine.some((s) => studentMatchesSlot(u, s))).length;

  return (
    <div>
      <PageHeader title={`مرحباً، ${me!.profile.full_name}`} description={me!.profile.academic_rank ? RANK_LABELS[me!.profile.academic_rank] : "تدريسي"} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="محاضرات اليوم" value={todays.length} icon={CalendarDays} />
        <StatCard label="الشعب المسندة" value={mine.length} icon={BookOpen} tone="brass" />
        <StatCard label="عدد الطلبة" value={studentCount} icon={GraduationCap} tone="success" />
        <StatCard label="النصاب الأسبوعي" value={`${load.total} س`} {...(load.quota ? { hint: `من ${load.quota} ساعة` } : {})} icon={ClipboardCheck} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={`محاضرات اليوم — ${DAY_LABEL[today]}`} actions={<Link to="/attendance" className="text-sm font-semibold text-primary">تسجيل الحضور</Link>}>
          {todays.length === 0 ? <Empty icon={CalendarDays} text="لا توجد محاضرات اليوم" /> : (
            <ul className="space-y-2">
              {todays.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <div className="font-semibold text-foreground">{courseName.get(s.course_id)}</div>
                    <div className="text-xs text-muted-foreground">المرحلة {s.stage} {s.section ? `· شعبة ${s.section}` : ""} {s.sub_group ? `· ${s.sub_group}` : ""}</div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground" dir="ltr">{s.period_start.slice(0, 5)}–{s.period_end.slice(0, 5)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="آخر التبليغات" actions={<Link to="/messages" className="text-sm font-semibold text-primary">المراسلات</Link>}>
          {notices.length === 0 ? <Empty icon={FileText} text="لا توجد رسائل" /> : (
            <ul className="divide-y text-sm">
              {notices.map((n) => (
                <li key={n.id} className="py-2.5"><div className="font-semibold text-foreground">{n.subject || "بدون عنوان"}</div><div className="line-clamp-1 text-xs text-muted-foreground">{n.body}</div></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StudentDash() {
  const { me } = useMe();
  const { data: slots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: report = [] } = useAbsenceReport();
  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures_recent"],
    queryFn: async () => (await supabase.from("lectures").select("*").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: records = [] } = useQuery({
    queryKey: ["my_records"],
    queryFn: async () => (await supabase.from("attendance_records").select("status").eq("student_id", me!.profile.id)).data ?? [],
  });
  const p = me!.profile;
  const mySlots = slots.filter((s) => studentMatchesSlot(p, s));
  const myCourseIds = new Set(mySlots.map((s) => s.course_id));
  const today = new Date().getDay();
  const todays = mySlots.filter((s) => s.day_of_week === today);
  const courseName = nameMap(courses);
  const presentPct = records.length ? Math.round((records.filter((r) => r.status !== "absent").length / records.length) * 100) : 100;
  const myWarnings = report.filter((r) => r.student_id === p.id).map((r) => ({ ...r, level: warningLevel(Number(r.absence_pct ?? 0)) }));
  const warnCount = myWarnings.filter((w) => w.level !== "none").length;
  const recent = lectures.filter((l) => myCourseIds.has(l.course_id)).slice(0, 5);

  return (
    <div>
      <PageHeader title={`مرحباً، ${p.full_name}`} description={`المرحلة ${p.stage ?? "—"} ${p.section ? `· شعبة ${p.section}` : ""}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="نسبة الحضور" value={`${presentPct}%`} icon={ClipboardCheck} tone={presentPct >= 90 ? "success" : "destructive"} />
        <StatCard label="الإنذارات" value={warnCount} icon={AlertTriangle} tone={warnCount ? "destructive" : "success"} />
        <StatCard label="محاضرات اليوم" value={todays.length} icon={CalendarDays} tone="brass" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={`جدول اليوم — ${DAY_LABEL[today]}`}>
          {todays.length === 0 ? <Empty icon={CalendarDays} text="لا توجد محاضرات اليوم" /> : (
            <ul className="space-y-2">
              {todays.map((s) => (
                <li key={s.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-semibold text-foreground">{courseName.get(s.course_id)}</div>
                  <div className="font-mono text-xs text-muted-foreground" dir="ltr">{s.period_start.slice(0, 5)}–{s.period_end.slice(0, 5)}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="مؤشر الغياب لكل مادة">
          {myWarnings.length === 0 ? <Empty icon={ClipboardCheck} text="لا يوجد غياب مسجل" /> : (
            <ul className="space-y-3">
              {myWarnings.map((w) => (
                <li key={w.course_id} className="text-sm">
                  <div className="mb-1 flex justify-between"><span className="text-foreground">{w.course_name}</span><Badge variant={WARNING_BADGE[w.level]}>{w.absence_pct}%</Badge></div>
                  <Progress value={Math.min(Number(w.absence_pct) * 10, 100)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="أحدث المحاضرات" actions={<Link to="/lectures" className="text-sm font-semibold text-primary">الكل</Link>}>
          {recent.length === 0 ? <Empty icon={FileText} text="لا توجد محاضرات" /> : (
            <ul className="divide-y text-sm">
              {recent.map((l) => (
                <li key={l.id} className="py-2"><div className="font-semibold text-foreground">{l.title}</div><div className="text-xs text-muted-foreground">{courseName.get(l.course_id)}</div></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
