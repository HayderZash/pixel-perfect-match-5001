import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookMarked, Download, ExternalLink, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useColleges, useDepartments, nameMap, signedUrl, uploadFile } from "@/lib/data";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => pageHead("المكتبة المركزية", "كتب وبحوث ورسائل ومجلات أكاديمية."),
  component: LibraryPage,
});

const TYPES: Record<string, string> = { book: "كتاب", paper: "بحث", magazine: "مجلة", thesis: "رسالة/أطروحة" };

function LibraryPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: colleges = [] } = useColleges();
  const { data: depts = [] } = useDepartments();
  const { data: items = [] } = useQuery({
    queryKey: ["library"],
    queryFn: async () => (await supabase.from("library_resources").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  const admin = ["system_admin", "super_admin", "college_admin", "dept_admin"].includes(me!.role ?? "");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [dept, setDept] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", author: "", type: "book", category: "", college_id: me!.profile.college_id ?? "", department_id: "", link_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const deptName = nameMap(depts);

  const visible = items.filter((i) => {
    const s = q.trim();
    if (s && !i.title.includes(s) && !(i.author ?? "").includes(s) && !(i.category ?? "").includes(s)) return false;
    if (type && i.type !== type) return false;
    if (dept && i.department_id !== dept) return false;
    return true;
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const file_path = file ? await uploadFile(file, "library") : null;
      const { error } = await supabase.from("library_resources").insert({
        title: f.title,
        author: f.author || null,
        type: f.type as "book",
        category: f.category || null,
        college_id: f.college_id || null,
        department_id: f.department_id || null,
        link_url: f.link_url || null,
        file_path,
        uploaded_by: me!.profile.id,
      });
      if (error) throw new Error(error.message);
      toast.success("أضيف المصدر");
      setOpen(false);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["library"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="المكتبة المركزية" description="مستودع الكتب والبحوث والرسائل الجامعية" actions={admin && <Button onClick={() => setOpen(true)}><Plus className="ml-1 h-4 w-4" /> إضافة مصدر</Button>} />
      <Panel>
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <div className="relative"><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pr-9" placeholder="بحث بالعنوان أو المؤلف أو التخصص" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)}><option value="">كل الأنواع</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
          <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}><option value="">كل الأقسام</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect>
        </div>
        {visible.length === 0 ? <Empty icon={BookMarked} text="لا توجد مصادر" /> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((i) => (
              <li key={i.id} className="flex flex-col rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2"><b className="text-foreground">{i.title}</b><Badge variant="secondary">{TYPES[i.type]}</Badge></div>
                <div className="mt-1 text-xs text-muted-foreground">{i.author ?? "—"} {i.category ? `· ${i.category}` : ""} {i.department_id ? `· ${deptName.get(i.department_id)}` : ""}</div>
                <div className="mt-3 flex gap-2">
                  {i.file_path && <Button size="sm" variant="outline" onClick={async () => { try { window.open(await signedUrl(i.file_path!), "_blank"); } catch (e) { toast.error(errMsg(e)); } }}><Download className="ml-1 h-3.5 w-3.5" /> تنزيل</Button>}
                  {i.link_url && <Button size="sm" variant="outline" asChild><a href={i.link_url} target="_blank" rel="noreferrer"><ExternalLink className="ml-1 h-3.5 w-3.5" /> رابط</a></Button>}
                  {admin && <Button size="sm" variant="ghost" aria-label="حذف" onClick={async () => { if (!confirm("حذف؟")) return; await supabase.from("library_resources").delete().eq("id", i.id); qc.invalidateQueries({ queryKey: ["library"] }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>مصدر جديد</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="العنوان" className="sm:col-span-2"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="المؤلف"><Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></Field>
            <Field label="النوع"><NativeSelect value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
            <Field label="التخصص"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
            <Field label="الكلية"><NativeSelect value={f.college_id} onChange={(e) => setF({ ...f, college_id: e.target.value })}><option value="">عامة</option>{colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
            <Field label="القسم"><NativeSelect value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}><option value="">—</option>{depts.filter((d) => !f.college_id || d.college_id === f.college_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field>
            <Field label="الملف"><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <Field label="أو رابط" className="sm:col-span-2"><Input dir="ltr" type="url" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Button type="submit" className="w-full" disabled={busy}>حفظ</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
