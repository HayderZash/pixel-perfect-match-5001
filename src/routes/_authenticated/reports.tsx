import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSpreadsheet, Printer, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useCourseInstructors, useDepartments, useUsers, nameMap } from "@/lib/data";
import { courseTotalHours, warningLevel, WARNING_LABELS } from "@/lib/academic";
import { isTopAdmin } from "@/lib/roles";
import { docHeader, exportExcel, htmlTable, printDocument } from "@/lib/exporters";
import { Guard } from "@/components/app/AppShell";
import { Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => pageHead("القوائم الرسمية", "تصدير قوائم الحضور وأسماء الطلبة بصيغة PDF وExcel."),
  component: () => (
    <Guard feature="reports">
      <Reports />
    </Guard>
  ),
});

function Reports() {
  const { me } = useMe();
  const { data: courses = [] } = useCourses();
  const { data: links = [] } = useCourseInstructors();
  const { data: depts = [] } = useDepartments();
  const { data: users = [] } = useUsers();
  const p = me!.profile;
  const role = me!.role;
  const deptName = nameMap(depts);
  const myDepts = isTopAdmin(role) ? depts : role === "dept_admin" || role === "instructor" ? depts.filter((d) => d.id === p.department_id || role === "instructor") : depts.filter((d) => d.college_id === p.college_id);
  const myCourses = role === "instructor" ? courses.filter((c) => links.some((l) => l.course_id === c.id && l.instructor_id === p.id)) : courses.filter((c) => myDepts.some((d) => d.id === c.department_id));

  const [courseId, setCourseId] = useState("");
  const [dept, setDept] = useState("");
  const [stage, setStage] = useState("1");
  const [section, setSection] = useState("");

  const roster = (deptId: string, st: number, sec?: string) =>
    users
      .filter((u) => u.role === "student" && u.department_id === deptId && u.stage === st && (!sec || u.section === sec))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));

  async function attendanceSheet(kind: "pdf" | "excel") {
    const c = courses.find((x) => x.id === courseId);
    if (!c) return void toast.error("اختر المادة");
    try {
      const { data: sessions } = await supabase.from("attendance_sessions").select("id, session_date, hours").eq("course_id", c.id).order("session_date");
      const ids = (sessions ?? []).map((s) => s.id);
      const { data: recs } = ids.length ? await supabase.from("attendance_records").select("session_id, student_id, status").in("session_id", ids) : { data: [] };
      const students = roster(c.department_id, c.stage);
      const total = courseTotalHours(c);
      const mark = { present: "✓", absent: "غ", excused: "م" } as const;
      const headers = ["ت", "اسم الطالب", ...(sessions ?? []).map((s) => s.session_date.slice(5)), "ساعات الغياب", "النسبة %", "الحالة"];
      const rows = students.map((s, i) => {
        let absentH = 0;
        const cells = (sessions ?? []).map((ses) => {
          const r = recs?.find((x) => x.session_id === ses.id && x.student_id === s.id);
          if (r?.status === "absent") absentH += Number(ses.hours);
          return r ? mark[r.status as keyof typeof mark] : "";
        });
        const pct = Math.round((absentH * 10000) / total) / 100;
        return [i + 1, s.full_name, ...cells, absentH, pct, WARNING_LABELS[warningLevel(pct)]];
      });
      const title = `قائمة حضور مادة ${c.name} (${c.code})`;
      if (kind === "excel") exportExcel(title, "الحضور", headers, rows);
      else printDocument(title, `${docHeader(title, `${deptName.get(c.department_id)} — المرحلة ${c.stage} — مجموع الساعات ${total}`)}${htmlTable(headers, rows as (string | number)[][])}<p class="foot">✓ حاضر · غ غائب · م مُجاز</p><div class="sign"><div>توقيع التدريسي: ________</div><div>رئيس القسم: ________</div></div>`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  function rosterExport(kind: "pdf" | "excel") {
    if (!dept) return void toast.error("اختر القسم");
    const list = roster(dept, Number(stage), section || undefined);
    const headers = ["ت", "اسم الطالب", "اسم المستخدم", "الشعبة", "المجموعة", "الهاتف"];
    const rows = list.map((s, i) => [i + 1, s.full_name, s.username, s.section ?? "", s.sub_group ?? "", s.phone ?? ""]);
    const title = `قائمة أسماء طلبة ${deptName.get(dept)} — المرحلة ${stage}${section ? ` — شعبة ${section}` : ""}`;
    if (kind === "excel") exportExcel(title, "الطلبة", headers, rows);
    else printDocument(title, `${docHeader(title, `عدد الطلبة: ${list.length}`)}${htmlTable(headers, rows)}`);
  }

  return (
    <div>
      <PageHeader title="القوائم الرسمية" description="تصدير بنقرة واحدة وفق نماذج التقارير الجامعية" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="قائمة الحضور الرسمية للمادة">
          <Field label="المادة">
            <NativeSelect value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— اختر —</option>
              {myCourses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </NativeSelect>
          </Field>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => attendanceSheet("pdf")}><Printer className="ml-1 h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={() => attendanceSheet("excel")}><FileSpreadsheet className="ml-1 h-4 w-4" /> Excel</Button>
          </div>
        </Panel>
        {role !== "instructor" && (
          <Panel title="قائمة أسماء الطلبة">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="القسم">
                <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">—</option>
                  {myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </NativeSelect>
              </Field>
              <Field label="المرحلة">
                <NativeSelect value={stage} onChange={(e) => setStage(e.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{s}</option>)}
                </NativeSelect>
              </Field>
              <Field label="الشعبة">
                <NativeSelect value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">الكل</option>
                  {["A", "B", "C", "D"].map((s) => <option key={s} value={s}>{s}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => rosterExport("pdf")}><Printer className="ml-1 h-4 w-4" /> PDF</Button>
              <Button variant="outline" onClick={() => rosterExport("excel")}><FileSpreadsheet className="ml-1 h-4 w-4" /> Excel</Button>
            </div>
          </Panel>
        )}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ScrollText className="h-4 w-4" /> كتب الإنذارات الرسمية متاحة من صفحة الإنذارات.</p>
    </div>
  );
}
