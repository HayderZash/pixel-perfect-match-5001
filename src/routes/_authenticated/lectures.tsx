import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpen, ClipboardList, Download, ExternalLink, FileText, FlaskConical, Megaphone, Plus, Presentation, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useCourseInstructors, useSlots, useUsers, nameMap, signedUrl, uploadFile } from "@/lib/data";
import { studentMatchesSlot } from "@/lib/academic";
import { isTopAdmin } from "@/lib/roles";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/lectures")({
  head: () => pageHead("المحاضرات", "رفع وتنزيل المحاضرات والواجبات حسب المادة."),
  component: Lectures,
});

const KINDS: Record<string, string> = { lecture: "محاضرة", assignment: "واجب", slides: "عرض تقديمي", notice: "إعلان" };
const KIND_ICONS: Record<string, LucideIcon> = { lecture: FileText, assignment: ClipboardList, slides: Presentation, notice: Megaphone };
const SESSION: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  theory: { label: "نظري", icon: BookOpen, cls: "bg-primary/10 text-primary" },
  practical: { label: "عملي", icon: FlaskConical, cls: "bg-brass/20 text-brass-foreground" },
};

function Lectures() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: courses = [] } = useCourses();
  const { data: links = [] } = useCourseInstructors();
  const { data: slots = [] } = useSlots();
  const { data: users = [] } = useUsers();
  const { data: lectures = [] } = useQuery({
    queryKey: ["lectures"],
    queryFn: async () => (await supabase.from("lectures").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const p = me!.profile;
  const role = me!.role;
  const canUpload = role === "instructor" || isTopAdmin(role);
  const myCourses = isTopAdmin(role) ? courses : courses.filter((c) => links.some((l) => l.course_id === c.id && l.instructor_id === p.id));
  const studentCourseIds = new Set(slots.filter((s) => studentMatchesSlot(p, s)).map((s) => s.course_id));
  for (const c of courses) if (c.department_id === p.department_id && c.stage === p.stage) studentCourseIds.add(c.id);

  const [courseF, setCourseF] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ course_id: "", title: "", description: "", link_url: "", kind: "lecture", session_type: "theory" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const courseName = nameMap(courses);
  const userName = new Map(users.map((u) => [u.id, u.full_name]));

  const visible = lectures.filter((l) => {
    if (courseF && l.course_id !== courseF) return false;
    if (role === "student") return studentCourseIds.has(l.course_id);
    if (role === "instructor") return myCourses.some((c) => c.id === l.course_id);
    return true;
  });
  const filterCourses = role === "student" ? courses.filter((c) => studentCourseIds.has(c.id)) : role === "instructor" ? myCourses : courses;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !f.link_url) return void toast.error("أرفق ملفاً أو رابطاً");
    if (file && file.size > 50 * 1024 * 1024) return void toast.error("الحد الأقصى 50 ميغابايت");
    setBusy(true);
    try {
      const file_path = file ? await uploadFile(file, "lectures") : null;
      const { error } = await supabase.from("lectures").insert({ ...f, link_url: f.link_url || null, description: f.description || null, file_path, instructor_id: p.id });
      if (error) throw new Error(error.message);
      toast.success("رُفعت المحاضرة");
      setOpen(false);
      setF({ course_id: "", title: "", description: "", link_url: "", kind: "lecture", session_type: "theory" });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["lectures"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  async function download(path: string) {
    try {
      window.open(await signedUrl(path), "_blank");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function del(id: string) {
    if (!confirm("حذف المحاضرة؟")) return;
    await supabase.from("lectures").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lectures"] });
  }

  return (
    <div>
      <PageHeader title="المحاضرات" description="ملفات PDF والعروض والروابط والواجبات" actions={canUpload && <Button onClick={() => setOpen(true)}><Plus className="ml-1 h-4 w-4" /> رفع محاضرة</Button>} />
      <Panel>
        <div className="mb-4 max-w-xs">
          <NativeSelect value={courseF} onChange={(e) => setCourseF(e.target.value)}>
            <option value="">كل المواد</option>
            {filterCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </div>
        {visible.length === 0 ? <Empty icon={FileText} text="لا توجد محاضرات" /> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((l) => (
              <li key={l.id} className="flex gap-3 rounded-lg border p-4">
                {(() => { const S = SESSION[l.session_type] ?? SESSION["theory"]!; const K = l.kind === "lecture" ? S.icon : (KIND_ICONS[l.kind] ?? FileText); return <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${S.cls}`}><K className="h-5 w-5" /></div>; })()}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-foreground">{l.title}</b>
                    <div className="flex shrink-0 gap-1"><Badge variant={l.session_type === "practical" ? "brass" : "secondary"}>{SESSION[l.session_type]?.label ?? "نظري"}</Badge><Badge variant="outline">{KINDS[l.kind] ?? l.kind}</Badge></div>
                  </div>
                  <div className="text-xs text-muted-foreground">{courseName.get(l.course_id)} · {userName.get(l.instructor_id)} · {new Date(l.created_at).toLocaleDateString("ar-IQ")}</div>
                  {l.description && <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>}
                  <div className="mt-2 flex gap-2">
                    {l.file_path && <Button size="sm" variant="outline" onClick={() => download(l.file_path!)}><Download className="ml-1 h-3.5 w-3.5" /> تنزيل</Button>}
                    {l.link_url && <Button size="sm" variant="outline" asChild><a href={l.link_url} target="_blank" rel="noreferrer"><ExternalLink className="ml-1 h-3.5 w-3.5" /> فتح الرابط</a></Button>}
                    {(l.instructor_id === p.id || isTopAdmin(role)) && <Button size="sm" variant="ghost" onClick={() => del(l.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>رفع محاضرة</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid gap-3">
            <Field label="المادة">
              <NativeSelect required value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
                <option value="">— اختر —</option>
                {myCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="العنوان"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="النوع">
                <NativeSelect value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SESSION).map(([k, v]) => (
                <button type="button" key={k} onClick={() => setF({ ...f, session_type: k })} className={`flex items-center justify-center gap-2 rounded-lg border-2 p-2 font-semibold ${f.session_type === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <v.icon className="h-4 w-4" /> محاضرة {v.label}
                </button>
              ))}
            </div>
            <Field label="الوصف"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label="الملف (PDF، PPT…)"><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <Field label="أو رابط"><Input dir="ltr" type="url" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} /></Field>
            <Button type="submit" disabled={busy}>{busy ? "جارِ الرفع…" : "رفع"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
