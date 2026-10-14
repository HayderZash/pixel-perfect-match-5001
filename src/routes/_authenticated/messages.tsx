import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Inbox, Mail, MailOpen, Paperclip, PenSquare, Reply, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useCourses, useCourseInstructors, useDepartments, useUsers, signedUrl, uploadFile, type UserRow } from "@/lib/data";
import { ROLE_LABELS } from "@/lib/roles";
import { Empty, Field, NativeSelect, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => pageHead("المراسلات", "نظام المراسلات الهرمي المقيد حسب الصلاحيات."),
  component: Messages,
});

/** Client-side mirror of the database messaging rule (the database enforces it). */
function useAllowedRecipients() {
  const { me } = useMe();
  const { data: users = [] } = useUsers();
  const { data: links = [] } = useCourseInstructors();
  const { data: courses = [] } = useCourses();
  return useMemo(() => {
    if (!me?.role) return [] as UserRow[];
    const s = me.profile;
    const teaches = (instructorId: string, u: { department_id: string | null; stage: number | null }) =>
      links.some((l) => l.instructor_id === instructorId && courses.some((c) => c.id === l.course_id && c.department_id === u.department_id && c.stage === u.stage));
    return users.filter((r) => {
      if (r.id === s.id || !r.role || !r.is_active) return false;
      switch (me.role) {
        case "system_admin":
        case "super_admin":
          return true;
        case "college_admin":
          return r.role === "system_admin" || r.role === "super_admin" || r.college_id === s.college_id;
        case "dept_admin":
          return ((r.role === "instructor" || r.role === "student") && r.department_id === s.department_id) || (r.role === "college_admin" && r.college_id === s.college_id);
        case "registrar":
          return r.role === "student" && r.college_id === s.college_id;
        case "instructor":
          return (r.role === "dept_admin" && r.department_id === s.department_id) || (r.role === "student" && teaches(s.id, r));
        case "student":
          return r.role === "instructor" && teaches(r.id, s);
        default:
          return false;
      }
    });
  }, [me, users, links, courses]);
}

function Messages() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const { data: depts = [] } = useDepartments();
  const allowed = useAllowedRecipients();
  const uid = me!.profile.id;
  const [tab, setTab] = useState("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [to, setTo] = useState<string>("");
  const [group, setGroup] = useState({ role: "", dept: "", stage: "" });
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", tab],
    queryFn: async () => {
      const col = tab === "inbox" ? "receiver_id" : "sender_id";
      return (await supabase.from("messages").select("*").eq(col, uid).order("created_at", { ascending: false }).limit(300)).data ?? [];
    },
  });
  const current = msgs.find((m) => m.id === openId);

  const groupTargets = allowed.filter(
    (u) => (!group.role || u.role === group.role) && (!group.dept || u.department_id === group.dept) && (!group.stage || String(u.stage ?? "") === group.stage),
  );
  const canBroadcast = me!.role !== "student";

  async function open(id: string) {
    setOpenId(id);
    const m = msgs.find((x) => x.id === id);
    if (m && tab === "inbox" && !m.read_at) {
      await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", id);
      qc.invalidateQueries({ queryKey: ["messages"] });
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const targets = to === "__group" ? groupTargets.map((u) => u.id) : to ? [to] : [];
    if (!targets.length) return toast.error("اختر المستلم");
    setBusy(true);
    try {
      const attachment_path = file ? await uploadFile(file, "attachments") : null;
      const rows = targets.map((r) => ({ sender_id: uid, receiver_id: r, subject, body, attachment_path, is_broadcast: targets.length > 1 }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from("messages").insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message.includes("row-level") ? "غير مسموح لك بمراسلة هذا المستلم" : error.message);
      }
      toast.success(`أُرسلت الرسالة إلى ${targets.length}`);
      setCompose(false);
      setSubject("");
      setBody("");
      setFile(null);
      setTo("");
      qc.invalidateQueries({ queryKey: ["messages"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  const other = (m: (typeof msgs)[number]) => userMap.get(tab === "inbox" ? m.sender_id : m.receiver_id);
  const canReply = current && tab === "inbox" && allowed.some((a) => a.id === current.sender_id);

  return (
    <div>
      <PageHeader title="المراسلات" description="التواصل وفق الهرمية الجامعية" actions={allowed.length > 0 && <Button onClick={() => setCompose(true)}><PenSquare className="ml-1 h-4 w-4" /> رسالة جديدة</Button>} />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); setOpenId(null); }} className="mb-4">
        <TabsList><TabsTrigger value="inbox">الوارد</TabsTrigger><TabsTrigger value="sent">المرسل</TabsTrigger></TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          {msgs.length === 0 ? <Empty icon={Inbox} text="لا توجد رسائل" /> : (
            <ul className="-mx-2 divide-y">
              {msgs.map((m) => (
                <li key={m.id}>
                  <button onClick={() => open(m.id)} className={cn("flex w-full gap-3 rounded-md px-2 py-3 text-right hover:bg-muted", openId === m.id && "bg-muted")}>
                    {tab === "inbox" && !m.read_at ? <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm"><b className={cn("truncate text-foreground", tab === "inbox" && !m.read_at && "text-primary")}>{other(m)?.full_name ?? "—"}</b><span className="shrink-0 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString("ar-IQ")}</span></div>
                      <div className="truncate text-xs text-muted-foreground">{m.subject || m.body}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-3">
          {!current ? <Empty icon={Mail} text="اختر رسالة لعرضها" /> : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{current.subject || "بدون عنوان"}</h2>
                  <div className="text-xs text-muted-foreground">
                    {tab === "inbox" ? "من" : "إلى"}: {other(current)?.full_name} {other(current)?.role && <Badge variant="muted" className="mr-1">{ROLE_LABELS[other(current)!.role!]}</Badge>} · {new Date(current.created_at).toLocaleString("ar-IQ")}
                  </div>
                </div>
                <div className="flex gap-1">
                  {canReply && <Button size="sm" variant="outline" onClick={() => { setTo(current.sender_id); setSubject(`رد: ${current.subject}`); setCompose(true); }}><Reply className="ml-1 h-4 w-4" /> رد</Button>}
                  <Button size="sm" variant="ghost" aria-label="حذف" onClick={async () => { await supabase.from("messages").delete().eq("id", current.id); setOpenId(null); qc.invalidateQueries({ queryKey: ["messages"] }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap py-4 text-sm leading-7 text-foreground">{current.body}</p>
              {current.attachment_path && <Button size="sm" variant="outline" onClick={async () => { try { window.open(await signedUrl(current.attachment_path!), "_blank"); } catch (e) { toast.error(errMsg(e)); } }}><Paperclip className="ml-1 h-4 w-4" /> المرفق</Button>}
              {tab === "inbox" && !canReply && <p className="mt-4 text-xs text-muted-foreground">هذه رسالة باتجاه واحد ولا يمكن الرد عليها.</p>}
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={compose} onOpenChange={setCompose}>
        <DialogContent className="max-w-xl" dir="rtl">
          <DialogHeader><DialogTitle>رسالة جديدة</DialogTitle></DialogHeader>
          <form onSubmit={send} className="grid gap-3">
            <Field label="إلى">
              <NativeSelect value={to} onChange={(e) => setTo(e.target.value)} required>
                <option value="">— اختر —</option>
                {canBroadcast && <option value="__group">مجموعة (تعميم)</option>}
                {allowed.map((u) => <option key={u.id} value={u.id}>{u.full_name} — {u.role ? ROLE_LABELS[u.role] : ""}</option>)}
              </NativeSelect>
            </Field>
            {to === "__group" && (
              <div className="grid grid-cols-3 gap-2">
                <NativeSelect value={group.role} onChange={(e) => setGroup({ ...group, role: e.target.value })}>
                  <option value="">كل الأنواع</option>
                  {[...new Set(allowed.map((a) => a.role!))].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </NativeSelect>
                <NativeSelect value={group.dept} onChange={(e) => setGroup({ ...group, dept: e.target.value })}>
                  <option value="">كل الأقسام</option>
                  {depts.filter((d) => allowed.some((a) => a.department_id === d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </NativeSelect>
                <NativeSelect value={group.stage} onChange={(e) => setGroup({ ...group, stage: e.target.value })}>
                  <option value="">كل المراحل</option>
                  {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>المرحلة {s}</option>)}
                </NativeSelect>
                <p className="col-span-3 text-xs text-muted-foreground">سيتم الإرسال إلى {groupTargets.length} مستلم</p>
              </div>
            )}
            <Field label="الموضوع"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            <Field label="النص"><Textarea required rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <Field label="مرفق"><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
            <Button type="submit" disabled={busy}><Send className="ml-1 h-4 w-4" /> {busy ? "جارِ الإرسال…" : "إرسال"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
