// AI-assisted timetable proposal: the scheduler writes constraints in plain text, the model proposes slots.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiSlot = {
  day: number;
  start: string;
  end: string;
  course_id: string;
  session_type: "theory" | "practical";
  instructor_id: string | null;
  hall_id: string | null;
  note: string;
};

type Input = {
  constraints: string;
  shift: { start: string; end: string };
  days: { value: number; label: string }[];
  courses: { id: string; code: string; name: string; theory_remaining: number; practical_remaining: number; instructor_ids: string[] }[];
  instructors: { id: string; name: string }[];
  halls: { id: string; name: string; type: string; capacity: number | null }[];
  busy: { day: number; start: string; end: string; instructor_id: string | null; hall_id: string | null }[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slots", "summary"],
  properties: {
    summary: { type: "string" },
    slots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "start", "end", "course_id", "session_type", "instructor_id", "hall_id", "note"],
        properties: {
          day: { type: "integer" },
          start: { type: "string" },
          end: { type: "string" },
          course_id: { type: "string" },
          session_type: { type: "string", enum: ["theory", "practical"] },
          instructor_id: { type: ["string", "null"] },
          hall_id: { type: ["string", "null"] },
          note: { type: "string" },
        },
      },
    },
  },
};

const EDITORS = ["system_admin", "super_admin", "college_admin", "dept_admin"];

export const suggestTimetable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Input) => {
    if (!d || typeof d.constraints !== "string" || d.constraints.length > 4000) throw new Error("نص القيود غير صالح");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ slots: AiSlot[]; summary: string; error?: string }> => {
    const { data: role } = await context.supabase.rpc("user_role", { _user_id: context.userId });
    if (!EDITORS.includes(String(role))) return { slots: [], summary: "", error: "لا تملك صلاحية تعديل الجداول" };
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { slots: [], summary: "", error: "خدمة الذكاء الاصطناعي غير مهيأة" };

    const instructions = `أنت مساعد جدولة جامعية. اقترح محاضرات لجدول أسبوعي واحد.
قواعد إلزامية:
- الأيام المسموحة (day): ${data.days.map((d) => `${d.value}=${d.label}`).join("، ")}.
- كل الأوقات بصيغة HH:MM وبخطوات نصف ساعة، داخل الدوام من ${data.shift.start} إلى ${data.shift.end}، والنهاية بعد البداية.
- لا تجدول أكثر من الساعات المتبقية لكل مادة (نظري/عملي)، وحاول إكمالها.
- لا تداخل في نفس الجدول، ولا تداخل للتدريسي أو القاعة مع الأوقات المشغولة (busy).
- استخدم فقط المعرفات (id) الموجودة. فضّل التدريسيين المسندين للمادة. العملي في مختبر أو ورشة، والنظري في قاعة أو مدرج.
- طبّق قيود المستخدم النصية قدر الإمكان، واذكر في summary ما تعذّر تطبيقه. اكتب summary و note بالعربية.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        instructions,
        input: [{ role: "user", content: `قيود المستخدم:\n${data.constraints || "لا توجد"}\n\nالبيانات (JSON):\n${JSON.stringify({ courses: data.courses, instructors: data.instructors, halls: data.halls, busy: data.busy })}` }],
        text: { format: { type: "json_schema", name: "timetable", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("AI gateway", res.status, t);
      const msg = res.status === 429 ? "طلبات كثيرة، حاول بعد قليل" : res.status === 402 ? "نفد رصيد الذكاء الاصطناعي" : res.status === 403 ? "الخدمة غير متاحة لهذه المساحة" : "تعذّر إنشاء الاقتراح";
      return { slots: [], summary: "", error: msg };
    }

    let text = "";
    let failed = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") failed = ev.error?.message ?? ev.response?.error?.message ?? "failed";
        } catch {
          /* ignore partial */
        }
      }
    }
    if (failed || !text) {
      console.error("AI stream", failed);
      return { slots: [], summary: "", error: "لم يُرجع النموذج اقتراحاً" };
    }
    try {
      const out = JSON.parse(text) as { slots: AiSlot[]; summary: string };
      return { slots: out.slots ?? [], summary: out.summary ?? "" };
    } catch {
      return { slots: [], summary: "", error: "تعذّر قراءة الاقتراح" };
    }
  });
