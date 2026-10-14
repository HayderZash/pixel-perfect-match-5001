// Offline-resilient attendance: submissions are queued in localStorage when the
// network fails and flushed automatically when the browser comes back online.
import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "present" | "absent" | "excused";
export type PendingSubmission = {
  key: string;
  slot_id: string;
  course_id: string;
  session_date: string;
  hours: number;
  marks: Record<string, AttendanceStatus>;
};

const QUEUE = "att-queue";

export function loadQueue(): PendingSubmission[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) ?? "[]");
  } catch {
    return [];
  }
}
function saveQueue(q: PendingSubmission[]) {
  localStorage.setItem(QUEUE, JSON.stringify(q));
}
export function enqueue(s: PendingSubmission) {
  saveQueue([...loadQueue().filter((x) => x.key !== s.key), s]);
}

export async function submitAttendance(s: PendingSubmission) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("غير مسجل");
  const { data: existing, error: e1 } = await supabase
    .from("attendance_sessions")
    .select("id")
    .eq("slot_id", s.slot_id)
    .eq("session_date", s.session_date)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  let sessionId = existing?.id;
  if (!sessionId) {
    const { data: ins, error } = await supabase
      .from("attendance_sessions")
      .insert({ slot_id: s.slot_id, course_id: s.course_id, session_date: s.session_date, hours: s.hours, instructor_id: u.user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    sessionId = ins.id;
  }
  const rows = Object.entries(s.marks).map(([student_id, status]) => ({ session_id: sessionId!, student_id, status }));
  if (rows.length) {
    const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "session_id,student_id" });
    if (error) throw new Error(error.message);
  }
  return sessionId;
}

export const isNetworkError = (e: unknown) =>
  (typeof navigator !== "undefined" && !navigator.onLine) ||
  (e instanceof Error && /fetch|network|Failed to fetch|Load failed/i.test(e.message));

export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const q = loadQueue();
  let sent = 0;
  const remaining: PendingSubmission[] = [];
  for (const s of q) {
    try {
      await submitAttendance(s);
      sent++;
    } catch (e) {
      if (isNetworkError(e)) remaining.push(s);
    }
  }
  saveQueue(remaining);
  return { sent, failed: remaining.length };
}
