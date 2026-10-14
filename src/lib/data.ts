// Shared read queries (RLS-scoped browser client).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "./roles";

type T<N extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][N]["Row"];
export type College = T<"colleges">;
export type Department = T<"departments">;
export type Hall = T<"halls">;
export type Course = T<"courses">;
export type Slot = T<"timetable_slots">;
export type UserRow = T<"profiles"> & { role: AppRole | null };

function must<D>(r: { data: D | null; error: { message: string } | null }): D {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as D;
}

export const useColleges = () =>
  useQuery({ queryKey: ["colleges"], queryFn: async () => must(await supabase.from("colleges").select("*").order("name")) });
export const useDepartments = () =>
  useQuery({ queryKey: ["departments"], queryFn: async () => must(await supabase.from("departments").select("*").order("name")) });
export const useHalls = () =>
  useQuery({ queryKey: ["halls"], queryFn: async () => must(await supabase.from("halls").select("*").order("name")) });
export const useCourses = () =>
  useQuery({ queryKey: ["courses"], queryFn: async () => must(await supabase.from("courses").select("*").order("code")) });
export const useCourseInstructors = () =>
  useQuery({
    queryKey: ["course_instructors"],
    queryFn: async () => must(await supabase.from("course_instructors").select("*")),
  });
export const useSlots = () =>
  useQuery({
    queryKey: ["slots"],
    queryFn: async () => must(await supabase.from("timetable_slots").select("*").order("period_start")),
  });

export async function fetchUsers(): Promise<UserRow[]> {
  const [profiles, roles] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(5000),
    supabase.from("user_roles").select("user_id, role").limit(5000),
  ]);
  const map = new Map<string, AppRole>();
  for (const r of must(roles)) map.set(r.user_id, r.role as AppRole);
  return must(profiles).map((p) => ({ ...p, role: map.get(p.id) ?? null }));
}
export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: fetchUsers });

export const useAbsenceReport = () =>
  useQuery({ queryKey: ["absence_report"], queryFn: async () => must(await supabase.rpc("get_absence_report")) });

export function nameMap<X extends { id: string; name: string }>(rows: X[] | undefined) {
  const m = new Map<string, string>();
  for (const r of rows ?? []) m.set(r.id, r.name);
  return m;
}

export async function logAction(action: string, details?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({ actor_id: data.user.id, action, details: (details ?? null) as never });
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("files").createSignedUrl(path, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function uploadFile(file: File, folder: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("غير مسجل");
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${u.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("files").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}
