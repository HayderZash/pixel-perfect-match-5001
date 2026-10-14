import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useUsers } from "@/lib/data";
import { Guard } from "@/components/app/AppShell";
import { Empty, PageHeader, Panel } from "@/components/app/kit";

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => pageHead("سجل النظام", "سجل العمليات الإدارية في المنظومة."),
  component: () => (
    <Guard feature="logs">
      <Logs />
    </Guard>
  ),
});

const ACTIONS: Record<string, string> = {
  create_users: "إنشاء حسابات",
  update_user: "تعديل حساب",
  create_college: "إضافة كلية",
  delete_college: "حذف كلية",
  create_department: "إضافة قسم",
  delete_department: "حذف قسم",
  create_hall: "إضافة قاعة",
  delete_hall: "حذف قاعة",
  create_course: "إضافة مادة",
  create_slot: "إضافة محاضرة للجدول",
  toggle_permission: "تعديل صلاحية",
};

function Logs() {
  const { data: users = [] } = useUsers();
  const name = new Map(users.map((u) => [u.id, u.full_name]));
  const { data: logs = [] } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  return (
    <div>
      <PageHeader title="سجل النظام" description="آخر 500 عملية" />
      <Panel>
        {logs.length === 0 ? <Empty icon={ScrollText} text="لا توجد عمليات" /> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-right text-xs text-muted-foreground"><th className="p-2">الوقت</th><th className="p-2">المستخدم</th><th className="p-2">العملية</th><th className="p-2">التفاصيل</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-IQ")}</td>
                  <td className="p-2">{name.get(l.actor_id ?? "") ?? "—"}</td>
                  <td className="p-2 font-semibold">{ACTIONS[l.action] ?? l.action}</td>
                  <td className="max-w-xs truncate p-2 font-mono text-xs text-muted-foreground" dir="ltr">{l.details ? JSON.stringify(l.details) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
