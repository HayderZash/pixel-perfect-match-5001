import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, DoorOpen, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useColleges, useDepartments, useHalls, logAction } from "@/lib/data";
import { isTopAdmin } from "@/lib/roles";
import { Guard } from "@/components/app/AppShell";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/structure")({
  head: () => pageHead("الكليات والأقسام", "إدارة هيكل الكليات والأقسام والقاعات."),
  component: () => (
    <Guard feature="structure">
      <Structure />
    </Guard>
  ),
});

function Structure() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const { data: halls = [] } = useHalls();
  const top = isTopAdmin(me?.role);
  const myCollege = me?.profile.college_id ?? "";
  const visibleColleges = top ? colleges : colleges.filter((c) => c.id === myCollege);

  const [college, setCollege] = useState({ name: "", code: "" });
  const [dept, setDept] = useState({ name: "", code: "", college_id: "", stages_count: 4 });
  const [hall, setHall] = useState({ name: "", capacity: "", college_id: "" });

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string, key: string, action: string) {
    const { error } = await p;
    if (error) return void toast.error(errMsg(new Error(error.message)));
    toast.success(ok);
    qc.invalidateQueries({ queryKey: [key] });
    logAction(action);
  }

  return (
    <div>
      <PageHeader title="الكليات والأقسام" description="أنشئ الهيكل الأكاديمي ثم اربط الحسابات والمواد به." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="الكليات">
          {top && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(supabase.from("colleges").insert({ name: college.name.trim(), code: college.code || null }), "أضيفت الكلية", "colleges", "create_college");
                setCollege({ name: "", code: "" });
              }}
            >
              <Input required placeholder="اسم الكلية" value={college.name} onChange={(e) => setCollege({ ...college, name: e.target.value })} />
              <Input placeholder="الرمز" className="w-24" value={college.code} onChange={(e) => setCollege({ ...college, code: e.target.value })} />
              <Button size="icon" type="submit" aria-label="إضافة"><Plus className="h-4 w-4" /></Button>
            </form>
          )}
          {visibleColleges.length === 0 ? <Empty icon={Building2} text="لا توجد كليات" /> : (
            <ul className="divide-y">
              {visibleColleges.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div><b className="text-foreground">{c.name}</b> <span className="text-muted-foreground">{c.code}</span>
                    <div className="text-xs text-muted-foreground">{depts.filter((d) => d.college_id === c.id).length} أقسام</div></div>
                  {top && (
                    <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => confirm("حذف الكلية وكل أقسامها؟") && run(supabase.from("colleges").delete().eq("id", c.id), "حُذفت", "colleges", "delete_college")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="الأقسام">
          <form
            className="mb-4 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const cid = top ? dept.college_id : myCollege;
              if (!cid) return void toast.error("اختر الكلية");
              run(supabase.from("departments").insert({ name: dept.name.trim(), code: dept.code || null, college_id: cid, stages_count: Number(dept.stages_count) || 4 }), "أضيف القسم", "departments", "create_department");
              setDept({ ...dept, name: "", code: "" });
            }}
          >
            {top && (
              <NativeSelect required value={dept.college_id} onChange={(e) => setDept({ ...dept, college_id: e.target.value })}>
                <option value="">— الكلية —</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            )}
            <div className="flex gap-2">
              <Input required placeholder="اسم القسم" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
              <Input type="number" min={1} max={7} title="عدد المراحل" className="w-20" value={dept.stages_count} onChange={(e) => setDept({ ...dept, stages_count: Number(e.target.value) })} />
              <Button size="icon" type="submit" aria-label="إضافة"><Plus className="h-4 w-4" /></Button>
            </div>
          </form>
          <ul className="divide-y">
            {depts.filter((d) => top || d.college_id === myCollege).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                <div><b className="text-foreground">{d.name}</b>
                  <div className="text-xs text-muted-foreground">{colleges.find((c) => c.id === d.college_id)?.name} · {d.stages_count} مراحل</div></div>
                <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => confirm("حذف القسم؟") && run(supabase.from("departments").delete().eq("id", d.id), "حُذف", "departments", "delete_department")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="القاعات">
          <form
            className="mb-4 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const cid = top ? hall.college_id || null : myCollege;
              run(supabase.from("halls").insert({ name: hall.name.trim(), capacity: hall.capacity ? Number(hall.capacity) : null, college_id: cid }), "أضيفت القاعة", "halls", "create_hall");
              setHall({ ...hall, name: "", capacity: "" });
            }}
          >
            {top && (
              <Field label="الكلية">
                <NativeSelect value={hall.college_id} onChange={(e) => setHall({ ...hall, college_id: e.target.value })}>
                  <option value="">مشتركة</option>
                  {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            <div className="flex gap-2">
              <Input required placeholder="اسم القاعة" value={hall.name} onChange={(e) => setHall({ ...hall, name: e.target.value })} />
              <Input type="number" placeholder="السعة" className="w-24" value={hall.capacity} onChange={(e) => setHall({ ...hall, capacity: e.target.value })} />
              <Button size="icon" type="submit" aria-label="إضافة"><Plus className="h-4 w-4" /></Button>
            </div>
          </form>
          {halls.length === 0 ? <Empty icon={DoorOpen} text="لا توجد قاعات" /> : (
            <ul className="divide-y">
              {halls.filter((h) => top || !h.college_id || h.college_id === myCollege).map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div><b className="text-foreground">{h.name}</b> <span className="text-xs text-muted-foreground">{h.capacity ? `${h.capacity} مقعد` : ""}</span></div>
                  <Button variant="ghost" size="icon" aria-label="حذف" onClick={() => run(supabase.from("halls").delete().eq("id", h.id), "حُذفت", "halls", "delete_hall")}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
