import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useDepartments, useHalls, useSlots, useUsers, nameMap, logAction, type Slot } from "@/lib/data";
import { WEEK_DAYS, studentMatchesSlot } from "@/lib/academic";
import { canEditStructure, isTopAdmin } from "@/lib/roles";
import { docHeader, esc, printDocument } from "@/lib/exporters";
import { Empty, Field, NativeSelect, PageHeader, Panel } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => pageHead("الجدول الدراسي", "جدول أسبوعي خالٍ من التعارضات بالشعب والمجموعات."),
  component: Timetable,
});

function Timetable() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: slots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: depts = [] } = useDepartments();
  const { data: halls = [] } = useHalls();
  const { data: users = [] } = useUsers();
  const p = me!.profile;
  const role = me!.role;
  const editor = canEditStructure(role);
  const personal = role === "student" || role === "instructor";

  const myDepts = useMemo(() => {
    if (isTopAdmin(role)) return depts;
    if (role === "dept_admin") return depts.filter((d) => d.id === p.department_id);
    return depts.filter((d) => d.college_id === p.college_id);
  }, [depts, role, p]);

  const [dept, setDept] = useState(p.department_id ?? "");
  const [stage, setStage] = useState(String(p.stage ?? 1));
  const [section, setSection] = useState("");
  const [open, setOpen] = useState(false);
  const blank = { course_id: "", instructor_id: "", hall_id: "", day_of_week: "6", period_start: "08:30", period_end: "10:30", section: "", sub_group: "", session_type: "theory" };
  const [f, setF] = useState(blank);

  const courseName = nameMap(courses);
  const hallName = nameMap(halls);
  const userName = new Map(users.map((u) => [u.id, u.full_name]));

  const shown: Slot[] = useMemo(() => {
    if (role === "student") return slots.filter((s) => studentMatchesSlot(p, s));
    if (role === "instructor") return slots.filter((s) => s.instructor_id === p.id);
    return slots.filter((s) => s.department_id === dept && String(s.stage) === stage && (!section || !s.section || s.section === section));
  }, [slots, role, p, dept, stage, section]);

  const times = [...new Set(shown.map((s) => `${s.period_start.slice(0, 5)}–${s.period_end.slice(0, 5)}`))].sort();
  const cell = (day: number, t: string) => shown.filter((s) => s.day_of_week === day && `${s.period_start.slice(0, 5)}–${s.period_end.slice(0, 5)}` === t);
  const deptObj = depts.find((d) => d.id === dept);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("timetable_slots").insert({
      department_id: dept,
      stage: Number(stage),
      section: f.section || null,
      sub_group: f.sub_group || null,
      day_of_week: Number(f.day_of_week),
      period_start: f.period_start,
      period_end: f.period_end,
      course_id: f.course_id,
      instructor_id: f.instructor_id || null,
      hall_id: f.hall_id || null,
      session_type: f.session_type as "theory",
    });
    if (error) return toast.error(error.message);
    toast.success("أضيفت المحاضرة للجدول");
    logAction("create_slot");
    setOpen(false);
    setF({ ...blank, day_of_week: f.day_of_week });
    qc.invalidateQueries({ queryKey: ["slots"] });
  }
  async function remove(id: string) {
    if (!confirm("حذف المحاضرة من الجدول؟")) return;
    const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["slots"] });
  }

  const slotLabel = (s: Slot) =>
    `${courseName.get(s.course_id) ?? ""}${s.session_type === "practical" ? " (عملي)" : ""}${s.section ? ` · ${s.section}` : ""}${s.sub_group ? ` · ${s.sub_group}` : ""}`;

  function print() {
    const head = `<tr><th>الوقت</th>${WEEK_DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr>`;
    const body = times
      .map((t) => `<tr><td>${t}</td>${WEEK_DAYS.map((d) => `<td>${cell(d.value, t).map((s) => `${esc(slotLabel(s))}<br/><small>${esc(userName.get(s.instructor_id ?? "") ?? "")} ${esc(hallName.get(s.hall_id ?? "") ?? "")}</small>`).join("<hr/>")}</td>`).join("")}</tr>`)
      .join("");
    printDocument("الجدول الدراسي", `${docHeader("الجدول الدراسي الأسبوعي", personal ? p.full_name : `${deptObj?.name ?? ""} — المرحلة ${stage}${section ? ` — شعبة ${section}` : ""}`)}<table><thead>${head}</thead><tbody>${body}</tbody></table>`);
  }

  const courseOptions = courses.filter((c) => c.department_id === dept && String(c.stage) === stage);
  const instructorOptions = users.filter((u) => u.role === "instructor" && (!deptObj || isTopAdmin(role) || u.college_id === deptObj.college_id));

  return (
    <div>
      <PageHeader
        title="الجدول الدراسي"
        description={personal ? "جدولك الأسبوعي" : "اختر القسم والمرحلة لعرض الجدول وتعديله"}
        actions={
          <>
            <Button variant="outline" onClick={print} disabled={!shown.length}><Printer className="ml-1 h-4 w-4" /> PDF</Button>
            {editor && <Button onClick={() => (dept ? setOpen(true) : toast.error("اختر القسم أولاً"))}><Plus className="ml-1 h-4 w-4" /> إضافة محاضرة</Button>}
          </>
        }
      />
      {!personal && (
        <Panel className="mb-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">— القسم —</option>
              {myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
            <NativeSelect value={stage} onChange={(e) => setStage(e.target.value)}>
              {Array.from({ length: deptObj?.stages_count ?? 6 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>المرحلة {s}</option>)}
            </NativeSelect>
            <Input placeholder="الشعبة (اختياري)" value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} />
          </div>
        </Panel>
      )}
      <Panel>
        {shown.length === 0 ? <Empty icon={CalendarDays} text="لا توجد محاضرات في الجدول" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border bg-muted p-2 text-right text-xs text-muted-foreground">الوقت</th>
                  {WEEK_DAYS.map((d) => <th key={d.value} className="border bg-muted p-2 text-right font-bold text-foreground">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {times.map((t) => (
                  <tr key={t}>
                    <td className="border p-2 font-mono text-xs text-muted-foreground" dir="ltr">{t}</td>
                    {WEEK_DAYS.map((d) => (
                      <td key={d.value} className="border p-1.5 align-top">
                        {cell(d.value, t).map((s) => (
                          <div key={s.id} className={`group mb-1 rounded-md p-2 ${s.session_type === "practical" ? "bg-brass/20" : "bg-primary/10"}`}>
                            <div className="font-semibold text-foreground">{slotLabel(s)}</div>
                            <div className="text-xs text-muted-foreground">{userName.get(s.instructor_id ?? "") ?? "—"} · {hallName.get(s.hall_id ?? "") ?? ""}</div>
                            {personal && role === "instructor" && <div className="text-xs text-muted-foreground">{depts.find((x) => x.id === s.department_id)?.name} · م{s.stage}</div>}
                            {editor && (
                              <button onClick={() => remove(s.id)} className="mt-1 hidden text-xs text-destructive group-hover:inline-flex" aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle>إضافة محاضرة — {deptObj?.name} · المرحلة {stage}</DialogTitle></DialogHeader>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <Field label="المادة" className="sm:col-span-2">
              <NativeSelect required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                <option value="">— اختر —</option>
                {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="اليوم">
              <NativeSelect value={f.day_of_week} onChange={(e) => setF({ ...f, day_of_week: e.target.value })}>
                {WEEK_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="النوع">
              <NativeSelect value={f.session_type} onChange={(e) => setF({ ...f, session_type: e.target.value })}>
                <option value="theory">نظري</option>
                <option value="practical">عملي</option>
              </NativeSelect>
            </Field>
            <Field label="من"><Input type="time" required value={f.period_start} onChange={(e) => setF({ ...f, period_start: e.target.value })} /></Field>
            <Field label="إلى"><Input type="time" required value={f.period_end} onChange={(e) => setF({ ...f, period_end: e.target.value })} /></Field>
            <Field label="الشعبة (A, B…)"><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value.toUpperCase() })} /></Field>
            <Field label="المجموعة (G1, G2…)"><Input value={f.sub_group} onChange={(e) => setF({ ...f, sub_group: e.target.value.toUpperCase() })} /></Field>
            <Field label="التدريسي">
              <NativeSelect value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}>
                <option value="">—</option>
                {instructorOptions.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="القاعة">
              <NativeSelect value={f.hall_id} onChange={(e) => setF({ ...f, hall_id: e.target.value })}>
                <option value="">—</option>
                {halls.filter((h) => !h.college_id || h.college_id === deptObj?.college_id).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </NativeSelect>
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">يمنع النظام تلقائياً تعارض التدريسي أو القاعة أو الشعبة في نفس الوقت.</p>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">حفظ</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
