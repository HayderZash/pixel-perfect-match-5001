import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { canAccess, type AppRole, type Feature } from "./roles";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Me = { profile: Profile; role: AppRole | null; disabled: Set<string> };

export const USERNAME_DOMAIN = "uni.local";
export const usernameToEmail = (u: string) => {
  const v = u.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${USERNAME_DOMAIN}`;
};

export const meQueryKey = ["me"] as const;

export async function fetchMe(): Promise<Me | null> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.rpc("user_role", { _user_id: uid }),
  ]);
  if (!profile) return null;
  const r = (role as AppRole | null) ?? null;
  const disabled = new Set<string>();
  if (r) {
    const { data: perms } = await supabase.from("role_permissions").select("feature, enabled").eq("role", r);
    for (const p of perms ?? []) if (!p.enabled) disabled.add(p.feature);
  }
  return { profile, role: r, disabled };
}

export function useMe() {
  const q = useQuery({ queryKey: meQueryKey, queryFn: fetchMe, staleTime: 60_000 });
  const me = q.data ?? null;
  return {
    ...q,
    me,
    can: (f: Feature) => canAccess(me?.role, f, me?.disabled),
  };
}
