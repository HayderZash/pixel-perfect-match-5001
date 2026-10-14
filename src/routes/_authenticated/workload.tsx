import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, Download } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useSlots, useUsers, useDepartments, nameMap } from "@/lib/data";
import { teachingLoad } from "@/lib/academic";
import { RANK_LABELS, RANK_QUOTA, isTopAdmin } from "@/lib/roles";
import { exportExcel } from "@/lib/exporters";
import { Guard } from "@/components/app/AppShell";
import { Empty, PageHeader, Panel } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/workload")({
  head: () => pageHead("النصاب التدريسي", "مقارنة ساعات التدريس الأسبوعية بنصاب اللقب العلمي."),
  component: () => (
    <Guard feature="workload">
      <Workload />
    </Guard>
  ),
});

const STATUS = { under: { l: "أقل من النصاب", v: "notice" }, ok: { l: "مطابق", v: "success" }, over: { l: "زائد (أجور إضافية)", v: "warning" } } as const;

function Workload() {
  const { me } = useMe();
  const { data: slots = [] } = useSlots();
  const { data: users = [] } = useUsers();
  const { data: depts = [] } = useDepartments();
  const deptName = nameMap(depts);
  const p = me!.profile;
  const role = me!.role;

  const rows = useMemo(() => {
    const list = users.filter((u) => {
      if (u.role !== "instructor") return false;
      if (role === "instructor") return u.id === p.id;
      if (role === "dept_admin") return u.department_id === p.department_id;
      if (role === "college_admin") return u.college_id === p.college_id;
      return isTopAdmin(role);
    });
    return list.map((u) => ({ u, load: teachingLoad(slots.filter((s) => s.instructor_id === u.id), u.academic_rank) }));
  }, [users, slots, role, p]);

  function excel() {
    exportExcel("النصاب_التدريسي", "النصاب", ["التدريسي", "اللقب", "القسم", "نظري", "عملي", "المجموع", "النصاب", "الفرق"], rows.map(({ u, load }) => [u.full_name, u.academic_rank ? RANK_LABELS[u.academic_rank] : "", deptName.get(u.department_id ?? "") ?? "", load.theory, load.practical, load.total, load.quota ?? "", load.quota != null ? load.total - load.quota : ""]));
  }

  return (
    <div>
      <PageHeader title="النصاب التدريسي" description={`النصاب الأسبوعي: ${Object.entries(RANK_QUOTA).map(([k, v]) => `${RANK_LABELS[k as keyof typeof RANK_LABELS]} ${v}`).join(" · ")}`} actions={<Button variant="outline" onClick={excel} disabled={!rows.length}><Download className="ml-1 h-4 w-4" /> Excel</Button>} />
      <Panel>
        {rows.length === 0 ? <Empty icon={BarChart3} text="لا يوجد تدريسيون" /> : (
          <ul className="space-y-4">
            {rows.map(({ u, load }) => (
              <li key={u.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><b className="text-foreground">{u.full_name}</b><div className="text-xs text-muted-foreground">{u.academic_rank ? RANK_LABELS[u.academic_rank] : "لم يُحدد اللقب"} · {deptName.get(u.department_id ?? "") ?? ""}</div></div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">نظري {load.theory} · عملي {load.practical}</span>
                    <b className="text-foreground">{load.total}{load.quota != null ? ` / ${load.quota}` : ""} ساعة</b>
                    {load.status && <Badge variant={STATUS[load.status].v}>{STATUS[load.status].l}</Badge>}
                  </div>
                </div>
                {load.quota != null && <Progress className="mt-3" value={Math.min((load.total / load.quota) * 100, 100)} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
