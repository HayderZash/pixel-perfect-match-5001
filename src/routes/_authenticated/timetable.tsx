import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowRight, BookOpen, CalendarDays, CalendarPlus, DoorOpen, FileDown, FileUp, FlaskConical, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useDepartments, useHalls, useSlots, useTimetables, useUsers, nameMap, logAction, type Slot, type Timetable as TT } from "@/lib/data";
import { HALL_TYPES, SHIFTS, WEEK_DAYS, lectureEnd, remainingCourseHours, shiftHours, slotHours, studentMatchesSlot, timeToMinutes, type Shift } from "@/lib/academic";
import { canEditStructure, isTopAdmin } from "@/lib/roles";
import { docHeader, esc, printDocument } from "@/lib/exporters";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => pageHead("الجدول الدراسي", "إنشاء جداول صباحية ومسائية كاملة وإدارة القاعات."),
  component: TimetablePage,
});

const DAY_BY_NAME = new Map(WEEK_DAYS.map((d) => [d.label, d.value]));
const hhmm = (t: string) => t.slice(0, 5);

function TimetablePage() {
  const { me } = useMe();
  const role = me!.role;
  const editor = canEditStructure(role);
  const personal = role === "student" || role === "instructor";
  if (personal) return <PersonalTimetable />;
  return (
    <div>
      <PageHeader title="الجدول الدراسي" description="أنشئ جدولاً كاملاً لكل مرحلة (صباحي أو مسائي) وأدر القاعات المرتبطة به." />
      <Tabs defaultValue="tables" dir="rtl">
        <TabsList className="mb-4">
          <TabsTrigger value="tables"><CalendarDays className="ml-1 h-4 w-4" /> الجداول</TabsTrigger>
          {editor && <TabsTrigger value="halls"><DoorOpen className="ml-1 h-4 w-4" /> القاعات</TabsTrigger>}
        </TabsList>
        <TabsContent value="tables"><Tables /></TabsContent>
        {editor && <TabsContent value="halls"><Halls /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ---------------- Personal (student / instructor) ----------------
function PersonalTimetable() {
  const { me } = useMe();
  const { data: slots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: halls = [] } = useHalls();
  const { data: users = [] } = useUsers();
  const p = me!.profile;
  const shown = me!.role === "student" ? slots.filter((s) => studentMatchesSlot(p, s)) : slots.filter((s) => s.instructor_id === p.id);
  const times = [...new Set(shown.map((s) => `${hhmm(s.period_start)}–${hhmm(s.period_end)}`))].sort();
  const cName = nameMap(courses);
  const hName = nameMap(halls);
  const uName = new Map(users.map((u) => [u.id, u.full_name]));
  const cell = (day: number, t: string) => shown.filter((s) => s.day_of_week === day && `${hhmm(s.period_start)}–${hhmm(s.period_end)}` === t);
  const label = (s: Slot) => `${cName.get(s.course_id) ?? ""} (${s.session_type === "practical" ? "عملي" : "نظري"})`;
  function print() {
    const head = `<tr><th>الوقت</th>${WEEK_DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr>`;
    const body = times.map((t) => `<tr><td>${t}</td>${WEEK_DAYS.map((d) => `<td>${cell(d.value, t).map((s) => `${esc(label(s))}<br/><small>${esc(uName.get(s.instructor_id ?? "") ?? "")} ${esc(hName.get(s.hall_id ?? "") ?? "")}</small>`).join("<hr/>")}</td>`).join("")}</tr>`).join("");
    printDocument("الجدول الدراسي", `${docHeader("الجدول الدراسي الأسبوعي", p.full_name)}<table><thead>${head}</thead><tbody>${body}</tbody></table>`);
  }
  return (
    <div>
      <PageHeader title="الجدول الدراسي" description="جدولك الأسبوعي" actions={<Button variant="outline" onClick={print} disabled={!shown.length}><Printer className="ml-1 h-4 w-4" /> PDF</Button>} />
      <Panel>
        {shown.length === 0 ? <Empty icon={CalendarDays} text="لا توجد محاضرات في جدولك" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead><tr><th className="border bg-muted p-2 text-right text-xs">الوقت</th>{WEEK_DAYS.map((d) => <th key={d.value} className="border bg-muted p-2 text-right">{d.label}</th>)}</tr></thead>
              <tbody>
                {times.map((t) => (
                  <tr key={t}>
                    <td className="border p-2 font-mono text-xs text-muted-foreground" dir="ltr">{t}</td>
                    {WEEK_DAYS.map((d) => (
                      <td key={d.value} className="border p-1.5 align-top">
                        {cell(d.value, t).map((s) => (
                          <div key={s.id} className={`mb-1 rounded-md p-2 ${s.session_type === "practical" ? "bg-brass/20" : "bg-primary/10"}`}>
                            <div className="font-semibold text-foreground">{label(s)}</div>
                            <div className="text-xs text-muted-foreground">{uName.get(s.instructor_id ?? "") ?? "—"} · {hName.get(s.hall_id ?? "") ?? ""}</div>
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
    </div>
  );
}

// ---------------- Timetables list ----------------
function Tables() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: depts = [] } = useDepartments();
  const { data: tables = [] } = useTimetables();
  const { data: slots = [] } = useSlots();
  const p = me!.profile;
  const role = me!.role;
  const editor = canEditStructure(role);
  const myDepts = useMemo(() => {
    if (isTopAdmin(role)) return depts;
    if (role === "dept_admin") return depts.filter((d) => d.id === p.department_id);
    return depts.filter((d) => d.college_id === p.college_id);
  }, [depts, role, p]);
  const [dept, setDept] = useState(p.department_id ?? "");
  const [stage, setStage] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const year = new Date().getFullYear();
  const [f, setF] = useState({ shift: "morning" as Shift, stage: "1", section: "", academic_year: `${year}-${year + 1}`, semester: "الفصل الأول", title: "" });
  const deptObj = depts.find((d) => d.id === dept);

  const list = tables.filter((t) => myDepts.some((d) => d.id === t.department_id) && (!dept || t.department_id === dept) && (!stage || String(t.stage) === stage));
  const opened = tables.find((t) => t.id === openId);
  if (opened) return <TimetableEditor table={opened} onBack={() => setOpenId(null)} />;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!dept) return void toast.error("اختر القسم");
    const { data, error } = await supabase
      .from("timetables")
      .insert({ department_id: dept, stage: Number(f.stage), section: f.section || null, shift: f.shift, academic_year: f.academic_year || null, semester: f.semester || null, title: f.title || null, created_by: p.id })
      .select("id")
      .single();
    if (error) return void toast.error(errMsg(new Error(error.message)));
    toast.success("أُنشئ الجدول — أضف المحاضرات الآن");
    logAction("create_timetable");
    await qc.invalidateQueries({ queryKey: ["timetables"] });
    setCreating(false);
    setOpenId(data.id);
  }
  async function del(id: string) {
    if (!confirm("حذف الجدول وكل محاضراته؟")) return;
    const { error } = await supabase.from("timetables").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["timetables"] });
    qc.invalidateQueries({ queryKey: ["slots"] });
  }

  return (
    <>
      <Panel className="mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="القسم" className="min-w-48 flex-1">
            <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">كل الأقسام</option>
              {myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="المرحلة" className="w-36">
            <NativeSelect value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="">الكل</option>
              {Array.from({ length: deptObj?.stages_count ?? 6 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>المرحلة {s}</option>)}
            </NativeSelect>
          </Field>
          {editor && <Button onClick={() => (dept ? (setF({ ...f, stage: stage || "1" }), setCreating(true)) : toast.error("اختر القسم أولاً"))}><CalendarPlus className="ml-1 h-4 w-4" /> إنشاء جدول</Button>}
        </div>
      </Panel>
      <Panel>
        {list.length === 0 ? <Empty icon={CalendarDays} text="لا توجد جداول — أنشئ جدولاً جديداً" /> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => {
              const n = slots.filter((s) => s.timetable_id === t.id);
              return (
                <li key={t.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button className="text-right" onClick={() => setOpenId(t.id)}>
                      <b className="text-foreground">{t.title || `جدول المرحلة ${t.stage}${t.section ? ` — شعبة ${t.section}` : ""}`}</b>
                      <div className="text-xs text-muted-foreground">{depts.find((d) => d.id === t.department_id)?.name} · {t.academic_year} · {t.semester}</div>
                    </button>
                    <Badge variant={t.shift === "evening" ? "secondary" : "brass"}>{SHIFTS[t.shift as Shift].label}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{n.length} محاضرة · {Math.round(n.reduce((a, s) => a + slotHours(s.period_start, s.period_end), 0))} ساعة أسبوعياً</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(t.id)}>فتح</Button>
                      {editor && <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => del(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>إنشاء جدول — {deptObj?.name}</DialogTitle></DialogHeader>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">نوع الدوام</span>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SHIFTS) as Shift[]).map((s) => (
                  <button type="button" key={s} onClick={() => setF({ ...f, shift: s })} className={`rounded-lg border-2 p-3 text-right transition ${f.shift === s ? "border-primary bg-primary/10" : "border-border"}`}>
                    <b className="text-foreground">{SHIFTS[s].label}</b>
                    <div className="font-mono text-xs text-muted-foreground" dir="ltr">{SHIFTS[s].start} – {SHIFTS[s].end}</div>
                  </button>
                ))}
              </div>
            </div>
            <Field label="المرحلة">
              <NativeSelect value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
                {Array.from({ length: deptObj?.stages_count ?? 6 }, (_, i) => i + 1).map((s) => <option key={s} value={s}>المرحلة {s}</option>)}
              </NativeSelect>
            </Field>
            <Field label="الشعبة (اختياري)"><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value.toUpperCase() })} /></Field>
            <Field label="العام الدراسي"><Input dir="ltr" value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} /></Field>
            <Field label="الفصل">
              <NativeSelect value={f.semester} onChange={(e) => setF({ ...f, semester: e.target.value })}>
                <option>الفصل الأول</option><option>الفصل الثاني</option><option>سنوي</option><option>الفصل الصيفي</option>
              </NativeSelect>
            </Field>
            <Field label="عنوان الجدول (اختياري)" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">إنشاء وفتح الجدول</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Editor ----------------
function TimetableEditor({ table, onBack }: { table: TT; onBack: () => void }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: allSlots = [] } = useSlots();
  const { data: courses = [] } = useCourses();
  const { data: depts = [] } = useDepartments();
  const { data: halls = [] } = useHalls();
  const { data: users = [] } = useUsers();
  const editor = canEditStructure(me!.role);
  const shift = table.shift as Shift;
  const hours = shiftHours(shift);
  const dept = depts.find((d) => d.id === table.department_id);
  const slots = allSlots.filter((s) => s.timetable_id === table.id);
  const courseOptions = courses.filter((c) => c.department_id === table.department_id && c.stage === table.stage);
  const instructorOptions = users.filter((u) => u.role === "instructor" && (!dept || u.college_id === dept.college_id || isTopAdmin(me!.role)));
  const hallOptions = halls.filter((h) => !h.college_id || h.college_id === dept?.college_id);
  const cName = nameMap(courses);
  const hName = nameMap(halls);
  const uName = new Map(users.map((u) => [u.id, u.full_name]));
  const fileRef = useRef<HTMLInputElement>(null);

  const blank = { day: 6, start: hours[0]!, course_id: "", session_type: "theory" as "theory" | "practical", hours: "2", instructor_id: "", hall_id: "", sub_group: "" };
  const [f, setF] = useState<typeof blank | null>(null);

  const startsAt = (day: number, h: string) => slots.filter((s) => s.day_of_week === day && hhmm(s.period_start) === h);
  const covered = (day: number, h: string) => slots.some((s) => s.day_of_week === day && timeToMinutes(hhmm(s.period_start)) < timeToMinutes(h) && timeToMinutes(hhmm(s.period_end)) > timeToMinutes(h));
  const courseStatus = (courseId: string, type: "theory" | "practical", extra: Slot[] = []) => {
    const c = courses.find((x) => x.id === courseId);
    if (!c) return null;
    return remainingCourseHours(c, type, [...slots, ...extra].filter((s) => s.course_id === courseId && s.session_type === type));
  };
  const typeLabel = (t: string) => (t === "practical" ? "عملي" : "نظري");

  function notifyRemaining(courseId: string, type: "theory" | "practical") {
    const st = courseStatus(courseId, type);
    if (!st) return;
    const name = cName.get(courseId);
    if (st.remaining > 0) toast.info(`تبليغ: مادة «${name}» (${typeLabel(type)}) متبقٍ منها ${st.remaining} ساعة من أصل ${st.required}`, { duration: 7000 });
    else if (st.remaining < 0) toast.warning(`مادة «${name}» (${typeLabel(type)}) تجاوزت ساعاتها المقررة بـ ${-st.remaining} ساعة`);
    else toast.success(`اكتملت ساعات مادة «${name}» (${typeLabel(type)})`);
  }

  async function insertSlot(row: { day: number; start: string; hours: number; course_id: string; session_type: "theory" | "practical"; instructor_id: string | null; hall_id: string | null; sub_group: string | null }) {
    const end = lectureEnd(shift, row.start, row.hours);
    if (!end) throw new Error(`المحاضرة تتجاوز نهاية الدوام ${SHIFTS[shift].label} (${SHIFTS[shift].end})`);
    const { error } = await supabase.from("timetable_slots").insert({
      timetable_id: table.id,
      department_id: table.department_id,
      stage: table.stage,
      section: table.section,
      sub_group: row.sub_group,
      day_of_week: row.day,
      period_start: row.start,
      period_end: end,
      course_id: row.course_id,
      instructor_id: row.instructor_id,
      hall_id: row.hall_id,
      session_type: row.session_type,
    });
    if (error) throw new Error(error.message);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f) return;
    try {
      await insertSlot({ day: f.day, start: f.start, hours: Number(f.hours), course_id: f.course_id, session_type: f.session_type, instructor_id: f.instructor_id || null, hall_id: f.hall_id || null, sub_group: f.sub_group || null });
      logAction("create_slot");
      await qc.invalidateQueries({ queryKey: ["slots"] });
      const st = courseStatus(f.course_id, f.session_type, [{ period_start: f.start, period_end: lectureEnd(shift, f.start, Number(f.hours))! } as Slot]);
      setF(null);
      if (st) {
        const name = cName.get(f.course_id);
        if (st.remaining > 0) toast.info(`تبليغ: مادة «${name}» (${typeLabel(f.session_type)}) متبقٍ منها ${st.remaining} ساعة من أصل ${st.required}`, { duration: 7000 });
        else if (st.remaining < 0) toast.warning(`مادة «${name}» تجاوزت ساعاتها المقررة بـ ${-st.remaining} ساعة`);
        else toast.success(`اكتملت ساعات مادة «${name}» (${typeLabel(f.session_type)})`);
      }
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف المحاضرة من الجدول؟")) return;
    const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["slots"] });
  }

  function downloadTemplate() {
    const rows = [["اليوم", "من الساعة", "عدد الساعات", "رمز المادة", "النوع (نظري/عملي)", "المجموعة", "اسم مستخدم التدريسي", "القاعة"]];
    for (const s of slots) {
      const c = courses.find((x) => x.id === s.course_id);
      rows.push([WEEK_DAYS.find((d) => d.value === s.day_of_week)?.label ?? "", hhmm(s.period_start), String(slotHours(s.period_start, s.period_end)), c?.code ?? "", typeLabel(s.session_type), s.sub_group ?? "", users.find((u) => u.id === s.instructor_id)?.username ?? "", hName.get(s.hall_id ?? "") ?? ""]);
    }
    if (!slots.length) rows.push([WEEK_DAYS[0]!.label, hours[0]!, "2", courseOptions[0]?.code ?? "CS101", "نظري", "", "", hallOptions[0]?.name ?? ""]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = rows[0]!.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "الجدول");
    const ref = [["الأيام", "أوقات البدء المسموحة", "رموز المواد", "القاعات"]];
    const n = Math.max(WEEK_DAYS.length, hours.length, courseOptions.length, hallOptions.length);
    for (let i = 0; i < n; i++) ref.push([WEEK_DAYS[i]?.label ?? "", hours[i] ?? "", courseOptions[i] ? `${courseOptions[i]!.code} — ${courseOptions[i]!.name}` : "", hallOptions[i]?.name ?? ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ref), "مرجع");
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, `قالب-جدول-${dept?.name ?? ""}-م${table.stage}-${SHIFTS[shift].label}.xlsx`);
  }

  async function importTemplate(file: File) {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]!]!);
    let ok = 0;
    const errors: string[] = [];
    const touched = new Set<string>();
    for (const [i, r] of rows.entries()) {
      const v = (k: string) => String(r[k] ?? "").trim();
      try {
        const day = DAY_BY_NAME.get(v("اليوم"));
        if (day == null) throw new Error("يوم غير معروف");
        const course = courseOptions.find((c) => c.code.toLowerCase() === v("رمز المادة").toLowerCase());
        if (!course) throw new Error("رمز مادة غير موجود في هذه المرحلة");
        const type = v("النوع (نظري/عملي)") === "عملي" ? "practical" : "theory";
        const inst = users.find((u) => u.username === v("اسم مستخدم التدريسي"));
        const hall = hallOptions.find((h) => h.name === v("القاعة"));
        let start = v("من الساعة");
        if (/^\d+(\.\d+)?$/.test(start)) { const m = Math.round(Number(start) * 24 * 60); start = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
        await insertSlot({ day, start, hours: Number(v("عدد الساعات")) || 1, course_id: course.id, session_type: type, instructor_id: inst?.id ?? null, hall_id: hall?.id ?? null, sub_group: v("المجموعة") || null });
        touched.add(`${course.id}|${type}`);
        ok++;
      } catch (e) {
        errors.push(`سطر ${i + 2}: ${errMsg(e)}`);
      }
    }
    await qc.invalidateQueries({ queryKey: ["slots"] });
    toast.success(`استُورد ${ok} محاضرة`);
    if (errors.length) toast.error(errors.slice(0, 5).join("\n"), { duration: 10000 });
    logAction("import_timetable", { ok, failed: errors.length });
    setTimeout(() => touched.forEach((k) => { const [c, t] = k.split("|"); notifyRemaining(c!, t as "theory"); }), 600);
  }

  function print() {
    const head = `<tr><th>الوقت</th>${WEEK_DAYS.map((d) => `<th>${d.label}</th>`).join("")}</tr>`;
    const body = hours.map((h) => `<tr><td>${h}</td>${WEEK_DAYS.map((d) => `<td>${startsAt(d.value, h).map((s) => `<b>${esc(cName.get(s.course_id))}</b> (${typeLabel(s.session_type)})<br/><small>${hhmm(s.period_start)}–${hhmm(s.period_end)} ${esc(uName.get(s.instructor_id ?? "") ?? "")} ${esc(hName.get(s.hall_id ?? "") ?? "")} ${esc(s.sub_group ?? "")}</small>`).join("<hr/>")}</td>`).join("")}</tr>`).join("");
    printDocument("الجدول الدراسي", `${docHeader(`الجدول الدراسي — ${SHIFTS[shift].label}`, `${dept?.name ?? ""} — المرحلة ${table.stage}${table.section ? ` — شعبة ${table.section}` : ""} — ${table.academic_year ?? ""} ${table.semester ?? ""}`)}<table><thead>${head}</thead><tbody>${body}</tbody></table>`);
  }

  // Course hour summary
  const summary = courseOptions.flatMap((c) => (["theory", "practical"] as const).filter((t) => (t === "theory" ? c.theoretical_hours : c.practical_hours) > 0).map((t) => ({ c, t, st: courseStatus(c.id, t)! })));
  const pick = f && f.course_id ? courseStatus(f.course_id, f.session_type) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="رجوع"><ArrowRight className="h-5 w-5" /></Button>
          <div>
            <h2 className="text-lg font-bold text-foreground">{table.title || `جدول المرحلة ${table.stage}${table.section ? ` — شعبة ${table.section}` : ""}`}</h2>
            <p className="text-xs text-muted-foreground">{dept?.name} · {SHIFTS[shift].label} ({SHIFTS[shift].start}–{SHIFTS[shift].end}) · {table.academic_year} · {table.semester}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="ml-1 h-4 w-4" /> تنزيل القالب</Button>
          {editor && <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="ml-1 h-4 w-4" /> رفع القالب</Button>}
          <Button variant="outline" size="sm" onClick={print}><Printer className="ml-1 h-4 w-4" /> PDF</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) importTemplate(x); e.target.value = ""; }} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-20 border bg-muted p-2 text-right text-xs text-muted-foreground">الساعة</th>
                  {WEEK_DAYS.map((d) => <th key={d.value} className="border bg-muted p-2 text-right font-bold text-foreground">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {hours.map((h) => (
                  <tr key={h}>
                    <td className="border p-2 font-mono text-xs text-muted-foreground" dir="ltr">{h}</td>
                    {WEEK_DAYS.map((d) => {
                      const here = startsAt(d.value, h);
                      return (
                        <td key={d.value} className={`group h-20 border p-1 align-top ${covered(d.value, h) && !here.length ? "bg-muted/40" : ""}`}>
                          {here.map((s) => (
                            <div key={s.id} className={`mb-1 rounded-md border-r-4 p-1.5 ${s.session_type === "practical" ? "border-brass bg-brass/15" : "border-primary bg-primary/10"}`}>
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex items-center gap-1 font-semibold text-foreground">
                                  {s.session_type === "practical" ? <FlaskConical className="h-3.5 w-3.5 shrink-0" /> : <BookOpen className="h-3.5 w-3.5 shrink-0" />}
                                  <span className="line-clamp-2">{cName.get(s.course_id)}</span>
                                </div>
                                {editor && <button onClick={() => remove(s.id)} aria-label="حذف" className="text-destructive opacity-60 hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>}
                              </div>
                              <div className="text-[11px] text-muted-foreground" dir="ltr">{hhmm(s.period_start)}–{hhmm(s.period_end)}</div>
                              <div className="text-[11px] text-muted-foreground">{uName.get(s.instructor_id ?? "") ?? ""} {s.hall_id ? `· ${hName.get(s.hall_id)}` : ""} {s.sub_group ? `· ${s.sub_group}` : ""}</div>
                            </div>
                          ))}
                          {editor && (
                            <button onClick={() => setF({ ...blank, day: d.value, start: h })} className="flex w-full items-center justify-center rounded-md border border-dashed py-1 text-xs text-muted-foreground opacity-0 transition hover:border-primary hover:text-primary group-hover:opacity-100 focus:opacity-100" aria-label="إضافة محاضرة">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="ساعات المواد">
          {summary.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مواد لهذه المرحلة. أضفها من صفحة المواد.</p> : (
            <ul className="space-y-2 text-sm">
              {summary.map(({ c, t, st }) => (
                <li key={c.id + t} className="rounded-md border p-2">
                  <div className="flex items-center gap-1 font-semibold text-foreground">{t === "practical" ? <FlaskConical className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />} {c.name} <span className="text-xs text-muted-foreground">({typeLabel(t)})</span></div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{st.scheduled} / {st.required} ساعة</span>
                    {st.remaining > 0 ? <Badge variant="notice">متبقٍ {st.remaining}</Badge> : st.remaining < 0 ? <Badge variant="destructive">زائد {-st.remaining}</Badge> : <Badge variant="success">مكتمل</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle>إضافة محاضرة — {WEEK_DAYS.find((d) => d.value === f?.day)?.label} الساعة {f?.start}</DialogTitle></DialogHeader>
          {f && (
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
              <Field label="المادة" className="sm:col-span-2">
                <NativeSelect required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                  <option value="">— اختر —</option>
                  {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </NativeSelect>
              </Field>
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                {(["theory", "practical"] as const).map((t) => (
                  <button type="button" key={t} onClick={() => setF({ ...f, session_type: t })} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-2 font-semibold ${f.session_type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {t === "practical" ? <FlaskConical className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />} {typeLabel(t)}
                  </button>
                ))}
              </div>
              {pick && (
                <p className={`sm:col-span-2 rounded-md p-2 text-xs ${pick.remaining > 0 ? "bg-warning/20 text-foreground" : "bg-muted text-muted-foreground"}`}>
                  الساعات المقررة أسبوعياً: {pick.required} · المجدولة: {pick.scheduled} · المتبقية: {pick.remaining}
                </p>
              )}
              <Field label="اليوم">
                <NativeSelect value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>
                  {WEEK_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </NativeSelect>
              </Field>
              <Field label="من الساعة">
                <NativeSelect value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })}>
                  {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                </NativeSelect>
              </Field>
              <Field label="عدد الساعات">
                <NativeSelect value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })}>
                  {[1, 1.5, 2, 3, 4, 5, 6].filter((n) => lectureEnd(shift, f.start, n)).map((n) => <option key={n} value={n}>{n} — حتى {lectureEnd(shift, f.start, n)}</option>)}
                </NativeSelect>
              </Field>
              <Field label="المجموعة (G1، G2…)"><Input value={f.sub_group} onChange={(e) => setF({ ...f, sub_group: e.target.value.toUpperCase() })} /></Field>
              <Field label="التدريسي">
                <NativeSelect value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })}>
                  <option value="">—</option>
                  {instructorOptions.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="القاعة">
                <NativeSelect value={f.hall_id} onChange={(e) => setF({ ...f, hall_id: e.target.value })}>
                  <option value="">—</option>
                  {hallOptions.filter((h) => f.session_type !== "practical" || h.hall_type !== "theater").map((h) => <option key={h.id} value={h.id}>{h.name} ({HALL_TYPES[h.hall_type] ?? h.hall_type}{h.capacity ? ` · ${h.capacity}` : ""})</option>)}
                </NativeSelect>
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">يمنع النظام تلقائياً تعارض التدريسي أو القاعة أو الشعبة في نفس الوقت.</p>
              <div className="sm:col-span-2"><Button type="submit" className="w-full">حفظ</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Halls ----------------
function Halls() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: halls = [] } = useHalls();
  const { data: slots = [] } = useSlots();
  const { data: colleges = [] } = useCourses().data ? { data: [] } : { data: [] };
  void colleges;
  const top = isTopAdmin(me!.role);
  const myCollege = me!.profile.college_id;
  const [h, setH] = useState({ name: "", capacity: "", hall_type: "classroom", building: "" });
  const visible = halls.filter((x) => top || !x.college_id || x.college_id === myCollege);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("halls").insert({ name: h.name.trim(), capacity: h.capacity ? Number(h.capacity) : null, hall_type: h.hall_type, building: h.building || null, college_id: top ? null : myCollege });
    if (error) return void toast.error(errMsg(new Error(error.message)));
    toast.success("أُضيفت القاعة");
    logAction("create_hall");
    setH({ ...h, name: "", capacity: "" });
    qc.invalidateQueries({ queryKey: ["halls"] });
  }
  async function del(id: string) {
    if (!confirm("حذف القاعة؟ ستُفك من المحاضرات المرتبطة بها.")) return;
    const { error } = await supabase.from("halls").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["halls"] });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Panel title="إنشاء قاعة">
        <form onSubmit={add} className="grid gap-3">
          <Field label="اسم / رقم القاعة"><Input required value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} /></Field>
          <Field label="النوع">
            <NativeSelect value={h.hall_type} onChange={(e) => setH({ ...h, hall_type: e.target.value })}>
              {Object.entries(HALL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="السعة"><Input type="number" min={1} value={h.capacity} onChange={(e) => setH({ ...h, capacity: e.target.value })} /></Field>
            <Field label="المبنى / الطابق"><Input value={h.building} onChange={(e) => setH({ ...h, building: e.target.value })} /></Field>
          </div>
          <Button type="submit"><Plus className="ml-1 h-4 w-4" /> إضافة</Button>
          <p className="text-xs text-muted-foreground">{top ? "القاعات التي ينشئها ادمن الجامعة مشتركة بين الكليات." : "القاعة تُربط بكليتك."} تُختار القاعة عند إضافة كل محاضرة في الجدول.</p>
        </form>
      </Panel>
      <Panel title={`القاعات (${visible.length})`}>
        {visible.length === 0 ? <Empty icon={DoorOpen} text="لا توجد قاعات" /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {visible.map((x) => {
              const used = slots.filter((s) => s.hall_id === x.id);
              const load = Math.round(used.reduce((a, s) => a + slotHours(s.period_start, s.period_end), 0));
              return (
                <li key={x.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <b className="text-foreground">{x.name}</b>
                    <div className="text-xs text-muted-foreground">{HALL_TYPES[x.hall_type] ?? x.hall_type}{x.capacity ? ` · ${x.capacity} مقعد` : ""}{x.building ? ` · ${x.building}` : ""}</div>
                    <div className="mt-1 text-xs text-muted-foreground">مشغولة {load} ساعة أسبوعياً · {used.length} محاضرة</div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => del(x.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
