import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useCourseInstructors, useDepartments, useUsers, nameMap, logAction } from "@/lib/data";
import { CLASSIFICATION_LABELS } from "@/lib/academic";
import { canEditStructure, isTopAdmin } from "@/lib/roles";
import { Empty, Field, NativeSelect, PageHeader, Panel } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => pageHead("المواد الدراسية", "المواد والخطط الدراسية وفق الساعات النظرية والعملية."),
  component: Courses,
});

const EMPTY = { code: "", name: "", department_id: "", stage: 1, credit_hours: 2, ects: "", theoretical_hours: 2, practical_hours: 0, semester_weeks: 15, classification: "specialized" };

function Courses() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: courses = [] } = useCourses();
  const { data: depts = [] } = useDepartments();
  const { data: links = [] } = useCourseInstructors();
  const { data: users = [] } = useUsers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("");
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const editor = canEditStructure(me?.role);
  const p = me!.profile;

  const myDepts = useMemo(() => {
    if (isTopAdmin(me?.role)) return depts;
    if (me?.role === "dept_admin") return depts.filter((d) => d.id === p.department_id);
    return depts.filter((d) => d.college_id === p.college_id);
  }, [depts, me, p]);
  const deptName = nameMap(depts);
  const userName = new Map(users.map((u) => [u.id, u.full_name]));
  const instructors = users.filter((u) => u.role === "instructor");

  const visible = courses.filter((c) => {
    if (filterDept && c.department_id !== filterDept) return false;
    if (me?.role === "student") return c.department_id === p.department_id && c.stage === p.stage;
    if (me?.role === "instructor") return links.some((l) => l.course_id === c.id && l.instructor_id === p.id);
    return true;
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      department_id: form.department_id,
      stage: Number(form.stage),
      credit_hours: Number(form.credit_hours),
      ects: form.ects ? Number(form.ects) : null,
      theoretical_hours: Number(form.theoretical_hours),
      practical_hours: Number(form.practical_hours),
      semester_weeks: Number(form.semester_weeks),
      classification: form.classification as "specialized",
    };
    const { error } = editId
      ? await supabase.from("courses").update(payload).eq("id", editId)
      : await supabase.from("courses").insert(payload);
    if (error) return void toast.error(error.message);
    toast.success(editId ? "عُدّلت المادة" : "أضيفت المادة");
    logAction(editId ? "update_course" : "create_course", { code: form.code });
    setOpen(false);
    setForm(EMPTY);
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["courses"] });
  }

  async function del(id: string) {
    if (!confirm("حذف المادة وكل ما يرتبط بها؟")) return;
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["courses"] });
  }

  async function assign(courseId: string, instructorId: string) {
    const { error } = await supabase.from("course_instructors").insert({ course_id: courseId, instructor_id: instructorId });
    if (error) return void toast.error(error.message.includes("duplicate") ? "مسند مسبقاً" : error.message);
    qc.invalidateQueries({ queryKey: ["course_instructors"] });
  }
  async function unassign(courseId: string, instructorId: string) {
    await supabase.from("course_instructors").delete().eq("course_id", courseId).eq("instructor_id", instructorId);
    qc.invalidateQueries({ queryKey: ["course_instructors"] });
  }

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const assignCourse = courses.find((c) => c.id === assignFor);

  return (
    <div>
      <PageHeader
        title="المواد الدراسية"
        description="الساعات النظرية والعملية والوحدات وفق إطار التعليم العالي."
        actions={editor && <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}><Plus className="ml-1 h-4 w-4" /> مادة جديدة</Button>}
      />
      <Panel>
        {editor && (
          <div className="mb-4 max-w-xs">
            <NativeSelect value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">كل الأقسام</option>
              {myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </div>
        )}
        {visible.length === 0 ? <Empty icon={BookOpen} text="لا توجد مواد" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرمز</TableHead>
                  <TableHead className="text-right">المادة</TableHead>
                  <TableHead className="text-right">القسم / المرحلة</TableHead>
                  <TableHead className="text-right">نظري/عملي</TableHead>
                  <TableHead className="text-right">الوحدات</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">التدريسيون</TableHead>
                  {editor && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="font-semibold">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{deptName.get(c.department_id)} · {c.stage}</TableCell>
                    <TableCell>{c.theoretical_hours}/{c.practical_hours}</TableCell>
                    <TableCell>{c.credit_hours}{c.ects ? ` (ECTS ${c.ects})` : ""}</TableCell>
                    <TableCell><Badge variant="brass">{CLASSIFICATION_LABELS[c.classification]}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {links.filter((l) => l.course_id === c.id).map((l) => userName.get(l.instructor_id)).join("، ") || "—"}
                    </TableCell>
                    {editor && (
                      <TableCell className="whitespace-nowrap">
                        <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => { setEditId(c.id); setForm({ code: c.code, name: c.name, department_id: c.department_id, stage: c.stage, credit_hours: Number(c.credit_hours), ects: c.ects != null ? String(c.ects) : "", theoretical_hours: Number(c.theoretical_hours), practical_hours: Number(c.practical_hours), semester_weeks: Number(c.semester_weeks), classification: c.classification }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="إسناد" onClick={() => setAssignFor(c.id)}><UserPlus className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>{editId ? "تعديل المادة" : "مادة دراسية جديدة"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="رمز المادة"><Input required value={form.code} onChange={set("code")} /></Field>
            <Field label="اسم المادة"><Input required value={form.name} onChange={set("name")} /></Field>
            <Field label="القسم">
              <NativeSelect required value={form.department_id} onChange={set("department_id")}>
                <option value="">— اختر —</option>
                {myDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="المرحلة"><Input type="number" min={1} max={7} value={form.stage} onChange={set("stage")} /></Field>
            <Field label="الساعات النظرية / أسبوع"><Input type="number" min={0} step="0.5" value={form.theoretical_hours} onChange={set("theoretical_hours")} /></Field>
            <Field label="الساعات العملية / أسبوع"><Input type="number" min={0} step="0.5" value={form.practical_hours} onChange={set("practical_hours")} /></Field>
            <Field label="الوحدات"><Input type="number" min={0} step="0.5" value={form.credit_hours} onChange={set("credit_hours")} /></Field>
            <Field label="ECTS (اختياري)"><Input type="number" min={0} step="0.5" value={form.ects} onChange={set("ects")} /></Field>
            <Field label="أسابيع الفصل"><Input type="number" min={1} value={form.semester_weeks} onChange={set("semester_weeks")} /></Field>
            <Field label="التصنيف الوزاري">
              <NativeSelect value={form.classification} onChange={set("classification")}>
                {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">{editId ? "حفظ التعديلات" : "حفظ"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إسناد تدريسيين — {assignCourse?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {links.filter((l) => l.course_id === assignFor).map((l) => (
              <div key={l.instructor_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                {userName.get(l.instructor_id)}
                <Button variant="ghost" size="icon" aria-label="إزالة" onClick={() => unassign(l.course_id, l.instructor_id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <NativeSelect value="" onChange={(e) => e.target.value && assignFor && assign(assignFor, e.target.value)}>
              <option value="">+ إضافة تدريسي</option>
              {instructors
                .filter((i) => !assignCourse || isTopAdmin(me?.role) || i.college_id === depts.find((d) => d.id === assignCourse.department_id)?.college_id)
                .map((i) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </NativeSelect>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
