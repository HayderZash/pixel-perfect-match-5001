import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { suggestTimetable, type AiSlot } from "@/lib/ai-timetable.functions";
import { DAY_LABEL, WEEK_DAYS, lectureEnd, slotHours, timeToMinutes, type Shift, SHIFTS } from "@/lib/academic";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  shift: Shift;
  courses: { id: string; code: string; name: string; theory_remaining: number; practical_remaining: number; instructor_ids: string[] }[];
  instructors: { id: string; name: string }[];
  halls: { id: string; name: string; type: string; capacity: number | null }[];
  busy: { day: number; start: string; end: string; instructor_id: string | null; hall_id: string | null }[];
  apply: (s: AiSlot) => Promise<void>;
  onDone: () => void;
};

export function AiTimetablePlanner(p: Props) {
  const run = useServerFn(suggestTimetable);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ slots: AiSlot[]; summary: string } | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const cName = new Map(p.courses.map((c) => [c.id, c.name]));
  const iName = new Map(p.instructors.map((i) => [i.id, i.name]));
  const hName = new Map(p.halls.map((h) => [h.id, h.name]));

  async function generate() {
    setLoading(true);
    setResult(null);
    try {
      const r = await run({ data: { constraints: text, shift: SHIFTS[p.shift], days: WEEK_DAYS, courses: p.courses, instructors: p.instructors, halls: p.halls, busy: p.busy } });
      if (r.error) return void toast.error(r.error);
      // keep only proposals that fit the shift and reference known data
      const valid = r.slots.filter(
        (s) => cName.has(s.course_id) && WEEK_DAYS.some((d) => d.value === s.day) && timeToMinutes(s.end) > timeToMinutes(s.start) && lectureEnd(p.shift, s.start, slotHours(s.start, s.end)),
      ).map((s) => ({ ...s, instructor_id: s.instructor_id && iName.has(s.instructor_id) ? s.instructor_id : null, hall_id: s.hall_id && hName.has(s.hall_id) ? s.hall_id : null }));
      setResult({ slots: valid, summary: r.summary });
      setPicked(new Set(valid.map((_, i) => i)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الاقتراح");
    } finally {
      setLoading(false);
    }
  }

  async function applyPicked() {
    if (!result) return;
    setSaving(true);
    let ok = 0;
    const errors: string[] = [];
    for (const [i, s] of result.slots.entries()) {
      if (!picked.has(i)) continue;
      try {
        await p.apply(s);
        ok++;
      } catch (e) {
        errors.push(`${cName.get(s.course_id)} ${DAY_LABEL[s.day]} ${s.start}: ${e instanceof Error ? e.message : ""}`);
      }
    }
    setSaving(false);
    if (ok) toast.success(`أضيفت ${ok} محاضرة`);
    if (errors.length) toast.error(`تعذّرت ${errors.length}: ${errors.slice(0, 3).join(" | ")}`, { duration: 9000 });
    p.onDone();
    if (!errors.length) setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Sparkles className="ml-1 h-4 w-4" /> توزيع مقترح</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>توزيع مقترح بالذكاء الاصطناعي</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">اكتب قيود التدريس والأوقات المطلوبة، وسيقترح النظام توزيعاً للساعات المتبقية حسب المواد والتدريسيين والقاعات المتاحة. راجع الاقتراح قبل اعتماده.</p>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
            placeholder="مثال: د. أحمد لا يدرّس يوم الخميس. المواد العملية بعد الساعة 11:00. لا محاضرات يوم الأربعاء بعد 12:30." />
          <Button onClick={generate} disabled={loading}>{loading ? <><Loader2 className="ml-1 h-4 w-4 animate-spin" /> جارٍ إنشاء الاقتراح…</> : <><Sparkles className="ml-1 h-4 w-4" /> إنشاء الاقتراح</>}</Button>
          {result && (
            <div className="space-y-3">
              {result.summary && <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">{result.summary}</div>}
              {result.slots.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد محاضرات مقترحة صالحة.</p> : (
                <ul className="space-y-1.5">
                  {result.slots.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      <Checkbox checked={picked.has(i)} onCheckedChange={(v) => { const n = new Set(picked); if (v) n.add(i); else n.delete(i); setPicked(n); }} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{cName.get(s.course_id)} <span className="text-xs text-muted-foreground">({s.session_type === "practical" ? "عملي" : "نظري"})</span></div>
                        <div className="text-xs text-muted-foreground">{DAY_LABEL[s.day]} · <span dir="ltr">{s.start}–{s.end}</span> · {iName.get(s.instructor_id ?? "") ?? "بدون تدريسي"} · {hName.get(s.hall_id ?? "") ?? "بدون قاعة"}</div>
                        {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {result.slots.length > 0 && <Button className="w-full" onClick={applyPicked} disabled={saving || picked.size === 0}>{saving ? "جارٍ الإضافة…" : `اعتماد ${picked.size} محاضرة`}</Button>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
