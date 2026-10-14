// University branding stored in app_settings (editable by top admins).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Branding = { university_name: string; university_motto: string; academic_year: string; current_semester: string; footer_note: string };
export const BRANDING_KEYS: (keyof Branding)[] = ["university_name", "university_motto", "academic_year", "current_semester", "footer_note"];
export const DEFAULT_BRANDING: Branding = { university_name: "الجامعة", university_motto: "نظام الإدارة الأكاديمية", academic_year: "", current_semester: "", footer_note: "" };

let cache: Branding = DEFAULT_BRANDING;
/** Last loaded branding, used by printable documents. */
export const currentBranding = () => cache;

export async function fetchBranding(): Promise<Branding> {
  const { data } = await supabase.from("app_settings").select("key, value");
  const b = { ...DEFAULT_BRANDING };
  for (const r of data ?? []) if ((BRANDING_KEYS as string[]).includes(r.key) && r.value) b[r.key as keyof Branding] = r.value;
  cache = b;
  return b;
}
export const useBranding = () => useQuery({ queryKey: ["branding"], queryFn: fetchBranding, staleTime: 5 * 60_000 });
