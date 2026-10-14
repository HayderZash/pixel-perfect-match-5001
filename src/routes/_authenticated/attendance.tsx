import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, CloudOff, Lock, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useDepartments, useSlots, useUsers, nameMap } from "@/lib/data";
import { DAY_LABEL, STATUS_LABELS, isSessionLocked, slotHours, studentMatchesSlot, todayISO } from "@/lib/academic";
import { isTopAdmin } from "@/lib/roles";
import { enqueue, flushQueue, isNetworkError, loadQueue, submitAttendance, type AttendanceStatus } from "@/lib/attendance-sync";
import { Guard } from "@/components/app/AppShell";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => pageHead("تسجيل الحضور", "تسجيل حضور الطلبة بنقرة واحدة مع العمل دون اتصال."),
  component: () => (
    <Guard feature="attendance">
      <Attendance />
    </Guard>
  ),
});

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-success text-success-foreground",
  absent: "bg-destructive text-destructive-foreground",
  excused: "bg-warning text-warning-foreground",
};
const NEXT: Record<AttendanceStatus, AttendanceStatus> = { present: "absent", absent: "excused", excused: "present" };

function Attendance() {
  const { me } = useMe();
  const role = me!.role;
  if (role === "instructor" || isTopAdmin(role)) return <Marking />;
  return <Audit />;
}

function Marking() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: slots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: users = [] } = useUsers();
  const { data: depts = [] } = useDepartments();
  const top = isTopAdmin(me!.role);
  const mySlots = top ? slots : slots.filter((s) => s.instructor_id === me!.profile.id);
  const [slotId, setSlotId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);
  const courseName = nameMap(courses);
  const deptName = nameMap(depts);
  const slot = slots.find((s) => s.id === slotId);

  useEffect(() => {
    const today = new Date().getDay();
    const t = mySlots.find((s) => s.day_of_week === today);
    if (!slotId && t) setSlotId(t.id);
  }, [mySlots, slotId]);

  useEffect(() => {
    setPending(loadQueue().length);
    setOnline(navigator.onLine);
    const sync = async () => {
      setOnline(true);
      const r = await flushQueue();
      setPending(loadQueue().length);
      if (r.sent) {
        toast.success(`تمت مزامنة ${r.sent} جلسة محفوظة`);
        qc.invalidateQueries({ queryKey: ["session"] });
      }
    };
    const off = () => setOnline(false);
    window.addEventListener("online", sync);
    window.addEventListener("offline", off);
    if (navigator.onLine && loadQueue().length) sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", off);
    };
  }, [qc]);

  const roster = useMemo(() => {
    if (!slot) return [];
    const list = users.filter((u) => u.role === "student" && u.is_active && studentMatchesSlot(u, slot)).sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    if (list.length) localStorage.setItem(`roster-${slot.id}`, JSON.stringify(list.map((u) => ({ id: u.id, full_name: u.full_name, username: u.username }))));
    return list.length ? list.map((u) => ({ id: u.id, full_name: u.full_name, username: u.username })) : (JSON.parse(localStorage.getItem(`roster-${slot.id}`) ?? "[]") as { id: string; full_name: string; username: string }[]);
  }, [slot, users]);

  const { data: session } = useQuery({
    queryKey: ["session", slotId, date],
    enabled: !!slotId,
    queryFn: async () => {
      const { data: s } = await supabase.from("attendance_sessions").select("*").eq("slot_id", slotId).eq("session_date", date).maybeSingle();
      if (!s) return null;
      const { data: recs } = await supabase.from("attendance_records").select("student_id, status").eq("session_id", s.id);
      return { ...s, recs: recs ?? [] };
    },
  });

  useEffect(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const r of roster) m[r.id] = "present";
    for (const r of session?.recs ?? []) m[r.student_id] = r.status as AttendanceStatus;
    setMarks(m);
  }, [roster, session]);

  const locked = !!session && isSessionLocked(session.submitted_at) && !top;
  const counts = Object.values(marks).reduce((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {} as Record<string, number>);

  async function save() {
    if (!slot) return;
    const sub = { key: `${slot.id}-${date}`, slot_id: slot.id, course_id: slot.course_id, session_date: date, hours: slotHours(slot.period_start, slot.period_end), marks };
    setSaving(true);
    try {
      await submitAttendance(sub);
      toast.success("حُفظ الحضور");
      qc.invalidateQueries({ queryKey: ["session", slotId, date] });
      qc.invalidateQueries({ queryKey: ["absence_report"] });
    } catch (e) {
      if (isNetworkError(e)) {
        enqueue(sub);
        setPending(loadQueue().length);
        toast.warning("لا يوجد اتصال — حُفظ الحضور على الجهاز وسيُرسل تلقائياً");
      } else toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const setAll = (s: AttendanceStatus) => setMarks(Object.fromEntries(roster.map((r) => [r.id, s])));

  return (
    <div>
      <PageHeader title="تسجيل الحضور" description="انقر على الطالب لتبديل حالته: حاضر ← غائب ← مُجاز" />
      {(!online || pending > 0) && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning bg-warning/15 p-3 text-sm text-foreground">
          <CloudOff className="h-5 w-5" />
          {!online ? "أنت غير متصل بالإنترنت. سيُحفظ الحضور على الجهاز." : `${pending} جلسة بانتظار المزامنة.`}
          {online && pending > 0 && (
            <Button size="sm" variant="outline" className="mr-auto" onClick={async () => { await flushQueue(); setPending(loadQueue().length); }}>
              <RefreshCw className="ml-1 h-3.5 w-3.5" /> مزامنة الآن
            </Button>
          )}
        </div>
      )}
      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="المحاضرة" className="sm:col-span-2">
            <NativeSelect value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <option value="">— اختر من جدولك —</option>
              {mySlots.map((s) => (
                <option key={s.id} value={s.id}>
                  {DAY_LABEL[s.day_of_week]} {s.period_start.slice(0, 5)} — {courseName.get(s.course_id)} · {deptName.get(s.department_id)} م{s.stage}{s.section ? ` ${s.section}` : ""}{s.sub_group ? ` ${s.sub_group}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="التاريخ"><Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </Panel>
      {!slot ? <Panel><Empty icon={ClipboardCheck} text="اختر محاضرة لعرض قائمة الطلبة" /></Panel> : (
        <Panel
          title={`${roster.length} طالب`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {locked && <Badge variant="danger"><Lock className="ml-1 h-3 w-3" /> مقفل (مرّ 7 أيام)</Badge>}
              {session && !locked && <Badge variant="muted">مُسجّل مسبقاً — يمكن التعديل</Badge>}
              <Badge variant="success">حاضر {counts["present"] ?? 0}</Badge>
              <Badge variant="danger">غائب {counts["absent"] ?? 0}</Badge>
              <Badge variant="notice">مُجاز {counts["excused"] ?? 0}</Badge>
            </div>
          }
        >
          {!locked && (
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAll("present")}><Check className="ml-1 h-3.5 w-3.5" /> الكل حاضر</Button>
              <Button size="sm" variant="outline" onClick={() => setAll("absent")}><X className="ml-1 h-3.5 w-3.5" /> الكل غائب</Button>
            </div>
          )}
          {roster.length === 0 ? <Empty icon={ClipboardCheck} text="لا يوجد طلبة مطابقون لهذه المرحلة/الشعبة" /> : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {roster.map((s, i) => {
                const st = marks[s.id] ?? "present";
                return (
                  <li key={s.id}>
                    <button
                      disabled={locked}
                      onClick={() => setMarks({ ...marks, [s.id]: NEXT[st] })}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border bg-background p-3 text-right transition hover:border-primary disabled:opacity-70"
                    >
                      <span className="text-sm"><span className="ml-2 text-xs text-muted-foreground">{i + 1}</span><b className="text-foreground">{s.full_name}</b></span>
                      <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold", STATUS_STYLE[st])}>{STATUS_LABELS[st]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!locked && roster.length > 0 && (
            <Button className="mt-4 w-full sm:w-auto" size="lg" onClick={save} disabled={saving}>{saving ? "جارِ الحفظ…" : "حفظ الحضور"}</Button>
          )}
        </Panel>
      )}
      {isTopAdmin(me!.role) && <div className="mt-6"><Audit /></div>}
    </div>
  );
}

function Audit() {
  const { data: courses = [] } = useCourses();
  const { data: users = [] } = useUsers();
  const courseName = nameMap(courses);
  const userName = new Map(users.map((u) => [u.id, u.full_name]));
  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions_audit"],
    queryFn: async () => (await supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <Panel title="سجل جلسات الحضور (تدقيق)">
      {sessions.length === 0 ? <Empty icon={ClipboardCheck} text="لا توجد جلسات" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-right text-xs text-muted-foreground"><th className="p-2">التاريخ</th><th className="p-2">المادة</th><th className="p-2">التدريسي</th><th className="p-2">الساعات</th><th className="p-2">الحالة</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="p-2 font-mono text-xs">{s.session_date}</td>
                  <td className="p-2">{courseName.get(s.course_id)}</td>
                  <td className="p-2">{userName.get(s.instructor_id)}</td>
                  <td className="p-2">{s.hours}</td>
                  <td className="p-2">{isSessionLocked(s.submitted_at) ? <Badge variant="muted"><Lock className="ml-1 h-3 w-3" />مقفل</Badge> : <Badge variant="success">قابل للتعديل</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
