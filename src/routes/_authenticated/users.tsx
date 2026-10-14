import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Lock, Pencil, Plus, Printer, Search, Unlock, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useColleges, useDepartments, useUsers, nameMap, type UserRow } from "@/lib/data";
import { createUsers, reissueCredentials, updateUser, type NewUserInput } from "@/lib/users.functions";
import { printCredentials } from "@/lib/credentials";
import { exportExcel, exportLockedTemplate, readSheet } from "@/lib/exporters";
import { requiredLinks } from "@/lib/roles";
import {
  CREATABLE_ROLES,
  RANK_LABELS,
  ROLE_LABELS,
  canManageUser,
  isCollegeScoped,
  isTopAdmin,
  type AcademicRank,
  type AppRole,
} from "@/lib/roles";
import { Guard } from "@/components/app/AppShell";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => pageHead("إدارة الحسابات", "إنشاء الحسابات واستيرادها وطباعة بطاقات الدخول."),
  component: () => (
    <Guard feature="users">
      <UsersPage />
    </Guard>
  ),
});

const EMPTY_FORM = {
  full_name: "",
  username: "",
  password: "",
  role: "student" as AppRole,
  college_id: "",
  department_id: "",
  stage: "",
  section: "",
  sub_group: "",
  academic_rank: "",
  phone: "",
};

function UsersPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useUsers();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("");
  const [deptF, setDeptF] = useState("");
  const [stageF, setStageF] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importRole, setImportRole] = useState<AppRole>("student");

  const role = me!.role!;
  const creatable = CREATABLE_ROLES[role];
  const scoped = isCollegeScoped(role);
  const caller = { id: me!.profile.id, role, college_id: me!.profile.college_id };
  const deptName = nameMap(depts);
  const collegeName = nameMap(colleges);
  const formCollege = scoped ? (me!.profile.college_id ?? "") : form.college_id;
  const deptOptions = depts.filter((d) => !formCollege || d.college_id === formCollege);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users.filter((u) => {
      if (scoped && u.college_id !== me!.profile.college_id) return false;
      if (role === "registrar" && u.role !== "student") return false;
      if (roleF && u.role !== roleF) return false;
      if (deptF && u.department_id !== deptF) return false;
      if (stageF && String(u.stage ?? "") !== stageF) return false;
      if (s && !u.full_name.toLowerCase().includes(s) && !u.username.includes(s)) return false;
      return true;
    });
  }, [users, q, roleF, deptF, stageF, scoped, role, me]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await createUsers({
        data: {
          users: [
            {
              ...form,
              college_id: formCollege || null,
              stage: form.stage ? Number(form.stage) : null,
              academic_rank: (form.academic_rank || null) as AcademicRank | null,
            },
          ],
        },
      });
      const r = res[0];
      if (r?.error) throw new Error(r.error);
      toast.success(`أنشئ الحساب: ${r?.username}`);
      if (r) await printCredentials([r], "بطاقة دخول");
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM, role: form.role, college_id: form.college_id, department_id: form.department_id, stage: form.stage });
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const sheet = await readSheet(file);
      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) if (r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
        return "";
      };
      const findId = (list: { id: string; name: string; code: string | null }[], v: string) =>
        list.find((x) => x.name === v || x.code === v)?.id ?? null;
      const list: NewUserInput[] = sheet
        .map((r) => {
          const collegeVal = pick(r, "الكلية", "college");
          const deptVal = pick(r, "القسم", "department");
          const college_id = scoped ? me!.profile.college_id : collegeVal ? findId(colleges, collegeVal) : null;
          return {
            full_name: pick(r, "الاسم", "الاسم الكامل", "full_name", "name"),
            username: pick(r, "اسم المستخدم", "username") || null,
            password: pick(r, "كلمة المرور", "password") || null,
            role: importRole,
            college_id,
            department_id: deptVal ? findId(depts.filter((d) => !college_id || d.college_id === college_id), deptVal) : null,
            stage: Number(pick(r, "المرحلة", "stage")) || null,
            section: pick(r, "الشعبة", "section") || null,
            sub_group: pick(r, "المجموعة", "sub_group") || null,
            phone: pick(r, "الهاتف", "phone") || null,
          };
        })
        .filter((u) => u.full_name);
      if (list.length === 0) throw new Error("لم يتم العثور على أسماء. تأكد من وجود عمود (الاسم)");
      const res = await createUsers({ data: { users: list } });
      const ok = res.filter((r) => !r.error);
      const bad = res.filter((r) => r.error);
      toast.success(`أنشئ ${ok.length} حساب${bad.length ? ` — فشل ${bad.length}` : ""}`);
      if (bad.length) toast.error(bad.slice(0, 3).map((b) => `${b.full_name}: ${b.error}`).join("\n"));
      if (ok.length) await printCredentials(ok);
      refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function printSelected(reset: boolean) {
    const ids = [...selected];
    if (!ids.length) return void toast.error("حدد حسابات أولاً");
    if (reset && !confirm("كلمات المرور لا تُخزَّن بشكل مقروء، لذا ستُولَّد كلمات مرور جديدة للحسابات المحددة وتُطبع على البطاقات. متابعة؟")) return;
    setBusy(true);
    try {
      const res = await reissueCredentials({ data: { ids, resetPassword: reset } });
      await printCredentials(res);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  function exportList() {
    exportExcel(
      "الحسابات",
      "الحسابات",
      ["الاسم", "اسم المستخدم", "الصلاحية", "الكلية", "القسم", "المرحلة", "الشعبة", "المجموعة"],
      rows.map((u) => [u.full_name, u.username, u.role ? ROLE_LABELS[u.role] : "", collegeName.get(u.college_id ?? "") ?? "", deptName.get(u.department_id ?? "") ?? "", u.stage ?? "", u.section ?? "", u.sub_group ?? ""]),
    );
  }

  function downloadTemplate() {
    const need = requiredLinks(importRole);
    const collegeOpts = scoped ? colleges.filter((c) => c.id === me!.profile.college_id) : colleges;
    const deptOpts = depts.filter((d) => collegeOpts.some((c) => c.id === d.college_id));
    const cols = [
      { header: "الاسم" },
      { header: "اسم المستخدم" },
      { header: "كلمة المرور" },
      { header: "الكلية", options: collegeOpts.map((c) => c.name) },
      { header: "القسم", options: deptOpts.map((d) => d.name) },
      { header: "المرحلة", options: ["1", "2", "3", "4", "5", "6"] },
      { header: "الشعبة" },
      { header: "المجموعة" },
      { header: "الهاتف" },
    ].filter((c) => (c.header === "القسم" ? need.department || importRole === "instructor" : true));
    exportLockedTemplate(`قالب_استيراد_${ROLE_LABELS[importRole]}`, "قالب", cols);
  }

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  const manageable = (u: UserRow) => canManageUser(caller, u);

  return (
    <div>
      <PageHeader
        title="إدارة الحسابات"
        description={`يمكنك إنشاء: ${creatable.map((r) => ROLE_LABELS[r]).join("، ") || "لا شيء"}`}
        actions={
          creatable.length > 0 && (
            <>
              <Button onClick={() => setCreateOpen(true)}><Plus className="ml-1 h-4 w-4" /> حساب جديد</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><FileUp className="ml-1 h-4 w-4" /> استيراد Excel/CSV</Button>
            </>
          )
        }
      />
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />

      {creatable.length > 0 && (
        <Panel className="mb-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">نوع الحسابات المستوردة:</span>
            <NativeSelect className="w-40" value={importRole} onChange={(e) => setImportRole(e.target.value as AppRole)}>
              {creatable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </NativeSelect>
            <Button variant="link" size="sm" onClick={downloadTemplate}><Download className="ml-1 h-4 w-4" /> تنزيل القالب</Button>
            <span className="text-xs text-muted-foreground">تُولّد أسماء المستخدمين وكلمات المرور ورموز QR تلقائياً ويُطبع ملف PDF بها.</span>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="بحث بالاسم أو اسم المستخدم" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <NativeSelect value={roleF} onChange={(e) => setRoleF(e.target.value)}>
            <option value="">كل الصلاحيات</option>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </NativeSelect>
          <NativeSelect value={deptF} onChange={(e) => setDeptF(e.target.value)}>
            <option value="">كل الأقسام</option>
            {depts.filter((d) => !scoped || d.college_id === me!.profile.college_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </NativeSelect>
          <NativeSelect value={stageF} onChange={(e) => setStageF(e.target.value)}>
            <option value="">كل المراحل</option>
            {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>المرحلة {s}</option>)}
          </NativeSelect>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{rows.length} حساب · محدد {selected.size}</span>
          <Button size="sm" variant="outline" onClick={() => printSelected(true)} disabled={busy}><Printer className="ml-1 h-4 w-4" /> طباعة بطاقات الدخول (QR + اسم المستخدم + كلمة المرور)</Button>
          <Button size="sm" variant="ghost" onClick={exportList}><Download className="ml-1 h-4 w-4" /> Excel</Button>
        </div>
        {isLoading ? null : rows.length === 0 ? <Empty icon={UsersIcon} text="لا توجد حسابات" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={selected.size > 0 && rows.filter(manageable).every((r) => selected.has(r.id))}
                      onCheckedChange={(c) => setSelected(c ? new Set(rows.filter(manageable).map((r) => r.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">اسم المستخدم</TableHead>
                  <TableHead className="text-right">الصلاحية</TableHead>
                  <TableHead className="text-right">القسم / المرحلة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 500).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{manageable(u) && <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />}</TableCell>
                    <TableCell className="font-semibold">{u.full_name}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">{u.username}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role ? ROLE_LABELS[u.role] : "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {deptName.get(u.department_id ?? "") ?? collegeName.get(u.college_id ?? "") ?? "—"}
                      {u.stage ? ` · م${u.stage}` : ""}{u.section ? ` · ${u.section}` : ""}{u.sub_group ? ` · ${u.sub_group}` : ""}
                    </TableCell>
                    <TableCell className="space-x-1 space-x-reverse">
                      {!u.is_active && <Badge variant="danger">معطّل</Badge>}
                      {u.is_profile_locked ? <Lock className="inline h-3.5 w-3.5 text-muted-foreground" /> : <Unlock className="inline h-3.5 w-3.5 text-muted-foreground/40" />}
                    </TableCell>
                    <TableCell>{manageable(u) && <Button variant="ghost" size="icon" aria-label="تعديل" onClick={() => setEdit(u)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>حساب جديد</DialogTitle></DialogHeader>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <Field label="الاسم الكامل" className="sm:col-span-2"><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="نوع الحساب">
              <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>
                {creatable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </NativeSelect>
            </Field>
            {!scoped && requiredLinks(form.role).college && (
              <Field label="الكلية (مطلوبة)">
                <NativeSelect required value={form.college_id} onChange={(e) => setForm({ ...form, college_id: e.target.value, department_id: "" })}>
                  <option value="">—</option>
                  {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {(requiredLinks(form.role).department || form.role === "instructor") && (
              <Field label={requiredLinks(form.role).department ? "القسم (مطلوب)" : "القسم"}>
                <NativeSelect required={requiredLinks(form.role).department} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">—</option>
                  {deptOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {form.role === "student" && (
              <>
                <Field label="المرحلة"><Input type="number" min={1} max={7} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} /></Field>
                <Field label="الشعبة (A, B…)"><Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} /></Field>
                <Field label="المجموعة العملية (G1…)"><Input value={form.sub_group} onChange={(e) => setForm({ ...form, sub_group: e.target.value.toUpperCase() })} /></Field>
              </>
            )}
            {form.role === "instructor" && (
              <Field label="اللقب العلمي">
                <NativeSelect value={form.academic_rank} onChange={(e) => setForm({ ...form, academic_rank: e.target.value })}>
                  <option value="">—</option>
                  {(Object.keys(RANK_LABELS) as AcademicRank[]).map((r) => <option key={r} value={r}>{RANK_LABELS[r]}</option>)}
                </NativeSelect>
              </Field>
            )}
            <Field label="اسم المستخدم (اختياري)"><Input dir="ltr" placeholder="يولّد تلقائياً" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="كلمة المرور (اختياري)"><Input dir="ltr" placeholder="تولّد تلقائياً" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="الهاتف"><Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={busy}>{busy ? "جارِ الإنشاء…" : "إنشاء وطباعة البطاقة"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {edit && <EditUser user={edit} onClose={() => setEdit(null)} onSaved={refresh} canLock={isTopAdmin(role)} scoped={scoped} />}
    </div>
  );
}

function EditUser({ user, onClose, onSaved, canLock, scoped }: { user: UserRow; onClose: () => void; onSaved: () => void; canLock: boolean; scoped: boolean }) {
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const [f, setF] = useState({
    full_name: user.full_name,
    college_id: user.college_id ?? "",
    department_id: user.department_id ?? "",
    stage: user.stage?.toString() ?? "",
    section: user.section ?? "",
    sub_group: user.sub_group ?? "",
    academic_rank: user.academic_rank ?? "",
    phone: user.phone ?? "",
    is_profile_locked: user.is_profile_locked,
    is_active: user.is_active,
    new_password: "",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateUser({
        data: {
          id: user.id,
          full_name: f.full_name,
          ...(scoped ? {} : { college_id: f.college_id || null }),
          department_id: f.department_id || null,
          stage: f.stage ? Number(f.stage) : null,
          section: f.section || null,
          sub_group: f.sub_group || null,
          academic_rank: (f.academic_rank || null) as AcademicRank | null,
          phone: f.phone || null,
          is_active: f.is_active,
          ...(canLock ? { is_profile_locked: f.is_profile_locked } : {}),
          ...(f.new_password ? { new_password: f.new_password } : {}),
        },
      });
      toast.success("حُفظت التعديلات");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader><DialogTitle>تعديل: {user.full_name}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم الكامل" className="sm:col-span-2"><Input required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          {!scoped && (
            <Field label="الكلية">
              <NativeSelect value={f.college_id} onChange={(e) => setF({ ...f, college_id: e.target.value })}>
                <option value="">—</option>
                {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="القسم">
            <NativeSelect value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}>
              <option value="">—</option>
              {depts.filter((d) => !f.college_id || d.college_id === f.college_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </Field>
          {user.role === "student" && (
            <>
              <Field label="المرحلة"><Input type="number" value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} /></Field>
              <Field label="الشعبة"><Input value={f.section} onChange={(e) => setF({ ...f, section: e.target.value.toUpperCase() })} /></Field>
              <Field label="المجموعة"><Input value={f.sub_group} onChange={(e) => setF({ ...f, sub_group: e.target.value.toUpperCase() })} /></Field>
            </>
          )}
          {user.role === "instructor" && (
            <Field label="اللقب العلمي">
              <NativeSelect value={f.academic_rank} onChange={(e) => setF({ ...f, academic_rank: e.target.value })}>
                <option value="">—</option>
                {(Object.keys(RANK_LABELS) as AcademicRank[]).map((r) => <option key={r} value={r}>{RANK_LABELS[r]}</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field label="الهاتف"><Input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="كلمة مرور جديدة (اختياري)"><Input dir="ltr" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} /></Field>
          <label className="flex items-center justify-between rounded-md border p-3 text-sm">الحساب مفعّل <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /></label>
          {canLock && (
            <label className="flex items-center justify-between rounded-md border p-3 text-sm">قفل تعديل الملف الشخصي <Switch checked={f.is_profile_locked} onCheckedChange={(v) => setF({ ...f, is_profile_locked: v })} /></label>
          )}
          <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={busy}>حفظ</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
