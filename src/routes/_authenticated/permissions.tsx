import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { logAction } from "@/lib/data";
import { meQueryKey } from "@/lib/me";
import { ALL_ROLES, FEATURE_LABELS, FEATURE_ROLES, ROLE_LABELS, TOGGLEABLE_FEATURES, type AppRole, type Feature } from "@/lib/roles";
import { Guard } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/kit";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/permissions")({
  head: () => pageHead("الصلاحيات", "مصفوفة إظهار الميزات لكل نوع حساب."),
  component: () => (
    <Guard feature="permissions">
      <Permissions />
    </Guard>
  ),
});

const ROLES = ALL_ROLES.filter((r) => r !== "system_admin");

function Permissions() {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => (await supabase.from("role_permissions").select("*")).data ?? [],
  });
  const enabled = (role: AppRole, f: Feature) => perms.find((p) => p.role === role && p.feature === f)?.enabled ?? true;

  async function toggle(role: AppRole, feature: Feature, value: boolean) {
    const { error } = await supabase.from("role_permissions").upsert({ role, feature, enabled: value }, { onConflict: "role,feature" });
    if (error) return toast.error(error.message);
    logAction("toggle_permission", { role, feature, value });
    qc.invalidateQueries({ queryKey: ["role_permissions"] });
    qc.invalidateQueries({ queryKey: meQueryKey });
  }

  return (
    <div>
      <PageHeader title="مصفوفة الصلاحيات" description="فعّل أو أخفِ الميزات لكل نوع حساب. ادمن النظام يملك كل الصلاحيات دائماً." />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-right text-xs text-muted-foreground">الميزة</th>
                {ROLES.map((r) => <th key={r} className="p-2 text-center font-bold text-foreground">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {TOGGLEABLE_FEATURES.map((f) => (
                <tr key={f} className="border-b">
                  <td className="p-2 font-semibold text-foreground">{FEATURE_LABELS[f]}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="p-2 text-center">
                      {FEATURE_ROLES[f].includes(r) ? <Switch checked={enabled(r, f)} onCheckedChange={(v) => toggle(r, f, v)} /> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
