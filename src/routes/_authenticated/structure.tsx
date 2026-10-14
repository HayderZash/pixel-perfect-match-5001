import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useColleges, useDepartments, logAction, type College, type Department } from "@/lib/data";
import { DEGREE_LABELS, SHIFT_LABELS, STUDY_SYSTEMS } from "@/lib/academic";
import { isTopAdmin } from "@/lib/roles";
import { Guard } from "@/components/app/AppShell";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/structure")({
  head: () => pageHead("الكليات والأقسام", "إدارة الكليات والأقسام ونظام الدراسة لكل منها."),
  component: () => (
    <Guard feature="structure">
      <Structure />
    </Guard>
  ),
});

const blankCollege = { name: "", code: "", study_system: "bologna", dean_name: "", shift: "morning", established_year: "", phone: "", email: "", location: "", description: "" };
const blankDept = { name: "", code: "", college_id: "", stages_count: "4", study_system: "bologna", head_name: "", degree: "bachelor", shift: "morning", total_credits: "", established_year: "", description: "" };
const num = (v: string) => (v ? Number(v) : null);
const opt = (v: string) => v.trim() || null;

function Structure() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const top = isTopAdmin(me?.role);
  const myCollege = me?.profile.college_id ?? "";
  const visibleColleges = top ? colleges : colleges.filter((c) => c.id === myCollege);

  const [cOpen, setCOpen] = useState<null | { id?: string }>(null);
  const [dOpen, setDOpen] = useState<null | { id?: string }>(null);
  const [c, setC] = useState(blankCollege);
  const [d, setD] = useState(blankDept);

  async function done(error: { message: string } | null, ok: string, key: string, action: string) {
    if (error) return void toast.error(errMsg(new Error(error.message)));
    toast.success(ok);
    qc.invalidateQueries({ queryKey: [key] });
    logAction(action);
  }

  function editCollege(x?: College) {
    setC(x ? { name: x.name, code: x.code ?? "", study_system: x.study_system, dean_name: x.dean_name ?? "", shift: x.shift, established_year: x.established_year ? String(x.established_year) : "", phone: x.phone ?? "", email: x.email ?? "", location: x.location ?? "", description: x.description ?? "" } : blankCollege);
    setCOpen({ id: x?.id });
  }
  function editDept(x?: Department) {
    setD(x ? { name: x.name, code: x.code ?? "", college_id: x.college_id, stages_count: String(x.stages_count), study_system: x.study_system, head_name: x.head_name ?? "", degree: x.degree, shift: x.shift, total_credits: x.total_credits ? String(x.total_credits) : "", established_year: x.established_year ? String(x.established_year) : "", description: x.description ?? "" } : { ...blankDept, college_id: top ? "" : myCollege });
    setDOpen({ id: x?.id });
  }

  async function saveCollege(e: React.FormEvent) {
    e.preventDefault();
    const row = { name: c.name.trim(), code: opt(c.code), study_system: c.study_system, dean_name: opt(c.dean_name), shift: c.shift, established_year: num(c.established_year), phone: opt(c.phone), email: opt(c.email), location: opt(c.location), description: opt(c.description) };
    const { error } = cOpen?.id ? await supabase.from("colleges").update(row).eq("id", cOpen.id) : await supabase.from("colleges").insert(row);
    await done(error, cOpen?.id ? "حُدّثت الكلية" : "أُنشئت الكلية", "colleges", cOpen?.id ? "update_college" : "create_college");
    if (!error) setCOpen(null);
  }
  async function saveDept(e: React.FormEvent) {
    e.preventDefault();
    const cid = top ? d.college_id : myCollege;
    if (!cid) return void toast.error("اختر الكلية");
    const row = { name: d.name.trim(), code: opt(d.code), college_id: cid, stages_count: Number(d.stages_count) || 4, study_system: d.study_system, head_name: opt(d.head_name), degree: d.degree, shift: d.shift, total_credits: num(d.total_credits), established_year: num(d.established_year), description: opt(d.description) };
    const { error } = dOpen?.id ? await supabase.from("departments").update(row).eq("id", dOpen.id) : await supabase.from("departments").insert(row);
    await done(error, dOpen?.id ? "حُدّث القسم" : "أُنشئ القسم", "departments", dOpen?.id ? "update_department" : "create_department");
    if (!error) setDOpen(null);
  }

  return (
    <div>
      <PageHeader title="الكليات والأقسام" description="أنشئ الهيكل الأكاديمي بكامل بياناته ثم اربط الحسابات والمواد به. القاعات تُدار من الجدول الدراسي." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="الكليات" actions={top && <Button size="sm" onClick={() => editCollege()}><Plus className="ml-1 h-4 w-4" /> إنشاء كلية</Button>}>
          {visibleColleges.length === 0 ? <Empty icon={Building2} text="لا توجد كليات" /> : (
            <ul className="grid gap-3">
              {visibleColleges.map((x) => (
                <li key={x.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="text-foreground">{x.name}</b> {x.code && <span className="font-mono text-xs text-muted-foreground">{x.code}</span>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="brass">{STUDY_SYSTEMS[x.study_system] ?? x.study_system}</Badge>
                        <Badge variant="outline">{SHIFT_LABELS[x.shift] ?? x.shift}</Badge>
                        <Badge variant="outline">{depts.filter((y) => y.college_id === x.id).length} أقسام</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {x.dean_name && <>العميد: {x.dean_name} · </>}{x.established_year && <>تأسست {x.established_year} · </>}{x.location}
                      </div>
                    </div>
                    {top && (
                      <div className="flex">
                        <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => editCollege(x)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" aria-label="حذف" onClick={async () => { if (!confirm("حذف الكلية وكل أقسامها؟")) return; const { error } = await supabase.from("colleges").delete().eq("id", x.id); done(error, "حُذفت", "colleges", "delete_college"); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="الأقسام" actions={<Button size="sm" onClick={() => editDept()}><Plus className="ml-1 h-4 w-4" /> إنشاء قسم</Button>}>
          {depts.filter((x) => top || x.college_id === myCollege).length === 0 ? <Empty icon={Layers} text="لا توجد أقسام" /> : (
            <ul className="grid gap-3">
              {depts.filter((x) => top || x.college_id === myCollege).map((x) => (
                <li key={x.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b className="text-foreground">{x.name}</b> {x.code && <span className="font-mono text-xs text-muted-foreground">{x.code}</span>}
                      <div className="text-xs text-muted-foreground">{colleges.find((y) => y.id === x.college_id)?.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="brass">{STUDY_SYSTEMS[x.study_system] ?? x.study_system}</Badge>
                        <Badge variant="outline">{DEGREE_LABELS[x.degree] ?? x.degree}</Badge>
                        <Badge variant="outline">{x.stages_count} مراحل</Badge>
                        <Badge variant="outline">{SHIFT_LABELS[x.shift] ?? x.shift}</Badge>
                      </div>
                      {x.head_name && <div className="mt-1 text-xs text-muted-foreground">رئيس القسم: {x.head_name}</div>}
                    </div>
                    <div className="flex">
                      <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => editDept(x)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="حذف" onClick={async () => { if (!confirm("حذف القسم؟")) return; const { error } = await supabase.from("departments").delete().eq("id", x.id); done(error, "حُذف", "departments", "delete_department"); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={!!cOpen} onOpenChange={(o) => !o && setCOpen(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{cOpen?.id ? "تعديل الكلية" : "إنشاء كلية"}</DialogTitle></DialogHeader>
          <form onSubmit={saveCollege} className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الكلية *"><Input required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
            <Field label="رمز الكلية"><Input dir="ltr" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="نظام الدراسة">
              <NativeSelect value={c.study_system} onChange={(e) => setC({ ...c, study_system: e.target.value })}>
                {Object.entries(STUDY_SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="نوع الدوام">
              <NativeSelect value={c.shift} onChange={(e) => setC({ ...c, shift: e.target.value })}>
                {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="اسم العميد"><Input value={c.dean_name} onChange={(e) => setC({ ...c, dean_name: e.target.value })} /></Field>
            <Field label="سنة التأسيس"><Input type="number" min={1900} max={2100} value={c.established_year} onChange={(e) => setC({ ...c, established_year: e.target.value })} /></Field>
            <Field label="الهاتف"><Input dir="ltr" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
            <Field label="البريد الإلكتروني"><Input dir="ltr" type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
            <Field label="الموقع / المبنى" className="sm:col-span-2"><Input value={c.location} onChange={(e) => setC({ ...c, location: e.target.value })} /></Field>
            <Field label="نبذة عن الكلية" className="sm:col-span-2"><Textarea value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">حفظ</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dOpen} onOpenChange={(o) => !o && setDOpen(null)}>
        <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{dOpen?.id ? "تعديل القسم" : "إنشاء قسم"}</DialogTitle></DialogHeader>
          <form onSubmit={saveDept} className="grid gap-3 sm:grid-cols-2">
            {top && (
              <Field label="الكلية *" className="sm:col-span-2">
                <NativeSelect required value={d.college_id} onChange={(e) => { const col = colleges.find((x) => x.id === e.target.value); setD({ ...d, college_id: e.target.value, study_system: col?.study_system ?? d.study_system }); }}>
                  <option value="">— اختر —</option>
                  {colleges.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            <Field label="اسم القسم *"><Input required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
            <Field label="رمز القسم"><Input dir="ltr" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="نظام الدراسة">
              <NativeSelect value={d.study_system} onChange={(e) => setD({ ...d, study_system: e.target.value })}>
                {Object.entries(STUDY_SYSTEMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="الشهادة الممنوحة">
              <NativeSelect value={d.degree} onChange={(e) => setD({ ...d, degree: e.target.value })}>
                {Object.entries(DEGREE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="عدد المراحل"><Input type="number" min={1} max={7} value={d.stages_count} onChange={(e) => setD({ ...d, stages_count: e.target.value })} /></Field>
            <Field label="نوع الدوام">
              <NativeSelect value={d.shift} onChange={(e) => setD({ ...d, shift: e.target.value })}>
                {Object.entries(SHIFT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="رئيس القسم"><Input value={d.head_name} onChange={(e) => setD({ ...d, head_name: e.target.value })} /></Field>
            <Field label={d.study_system === "bologna" ? "مجموع وحدات ECTS للتخرج" : "مجموع الوحدات للتخرج"}><Input type="number" min={0} value={d.total_credits} onChange={(e) => setD({ ...d, total_credits: e.target.value })} /></Field>
            <Field label="سنة التأسيس"><Input type="number" min={1900} max={2100} value={d.established_year} onChange={(e) => setD({ ...d, established_year: e.target.value })} /></Field>
            <Field label="نبذة عن القسم" className="sm:col-span-2"><Textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">حفظ</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
