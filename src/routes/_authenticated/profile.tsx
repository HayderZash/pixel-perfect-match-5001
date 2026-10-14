import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { meQueryKey, useMe } from "@/lib/me";
import { useColleges, useDepartments, nameMap } from "@/lib/data";
import { updateMyProfile } from "@/lib/users.functions";
import { RANK_LABELS, ROLE_LABELS } from "@/lib/roles";
import { Field, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => pageHead("الملف الشخصي", "بيانات حسابك وتغيير كلمة المرور."),
  component: Profile,
});

function Profile() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const p = me!.profile;
  const [name, setName] = useState(p.full_name);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [pw, setPw] = useState({ current: "", next: "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateMyProfile({ data: { full_name: name, phone } });
      toast.success("حُفظ الملف الشخصي");
      qc.invalidateQueries({ queryKey: meQueryKey });
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 6) return void toast.error("كلمة المرور 6 أحرف على الأقل");
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as never);
    if (error) return void toast.error(error.message.includes("current") ? "كلمة المرور الحالية غير صحيحة" : error.message);
    toast.success("تم تغيير كلمة المرور");
    setPw({ current: "", next: "" });
  }

  const info: [string, string][] = [
    ["اسم المستخدم", p.username],
    ["نوع الحساب", me!.role ? ROLE_LABELS[me!.role] : "—"],
    ["الكلية", nameMap(colleges).get(p.college_id ?? "") ?? "—"],
    ["القسم", nameMap(depts).get(p.department_id ?? "") ?? "—"],
  ];
  if (p.stage) info.push(["المرحلة", `${p.stage}${p.section ? ` · شعبة ${p.section}` : ""}${p.sub_group ? ` · ${p.sub_group}` : ""}`]);
  if (p.academic_rank) info.push(["اللقب العلمي", RANK_LABELS[p.academic_rank]]);

  return (
    <div>
      <PageHeader title="الملف الشخصي" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="معلومات الحساب">
          <dl className="space-y-3 text-sm">
            {info.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold text-foreground">{v}</dd></div>
            ))}
          </dl>
        </Panel>
        <Panel title="البيانات الشخصية">
          {p.is_profile_locked && <p className="mb-3 flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground"><Lock className="h-4 w-4" /> التعديل مقفل من قبل الادمن</p>}
          <form onSubmit={save} className="space-y-3">
            <Field label="الاسم الكامل"><Input disabled={p.is_profile_locked} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="الهاتف"><Input dir="ltr" disabled={p.is_profile_locked} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Button type="submit" disabled={p.is_profile_locked}>حفظ</Button>
          </form>
        </Panel>
        <Panel title="تغيير كلمة المرور">
          <form onSubmit={changePw} className="space-y-3">
            <Field label="كلمة المرور الحالية"><Input dir="ltr" type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="كلمة المرور الجديدة"><Input dir="ltr" type="password" required value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Button type="submit">تغيير</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
