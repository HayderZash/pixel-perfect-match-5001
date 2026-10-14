import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, FileText, ShieldAlert } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { useAbsenceReport, useColleges, useDepartments, nameMap } from "@/lib/data";
import { WARNING_BADGE, WARNING_LABELS, WARNING_THRESHOLDS, warningLevel, type WarningLevel } from "@/lib/academic";
import { esc, exportExcel, printDocument } from "@/lib/exporters";
import { Guard } from "@/components/app/AppShell";
import { Empty, NativeSelect, PageHeader, Panel, StatCard } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/warnings")({
  head: () => pageHead("الإنذارات", "احتساب تلقائي لنسب الغياب وإصدار كتب الإنذار الرسمية."),
  component: () => (
    <Guard feature="warnings">
      <Warnings />
    </Guard>
  ),
});

function Warnings() {
  const { me } = useMe();
  const { data: report = [] } = useAbsenceReport();
  const { data: depts = [] } = useDepartments();
  const { data: colleges = [] } = useColleges();
  const [level, setLevel] = useState<string>("");
  const [dept, setDept] = useState("");
  const deptName = nameMap(depts);
  const collegeName = nameMap(colleges);
  const isStudent = me!.role === "student";

  const rows = useMemo(
    () =>
      report
        .map((r) => ({ ...r, level: warningLevel(Number(r.absence_pct ?? 0)) as WarningLevel }))
        .filter((r) => (isStudent ? r.student_id === me!.profile.id : r.level !== "none"))
        .filter((r) => (!level || r.level === level) && (!dept || r.department_id === dept))
        .sort((a, b) => Number(b.absence_pct) - Number(a.absence_pct)),
    [report, level, dept, isStudent, me],
  );
  const count = (l: WarningLevel) => rows.filter((r) => r.level === l).length;

  function letters(list: typeof rows) {
    const html = list
      .map(
        (r) => `<div class="letter">
<div class="head"><div><h1>${esc(collegeName.get(r.college_id ?? "") ?? "الجامعة")}</h1><h2>${esc(deptName.get(r.department_id ?? "") ?? "")} — شعبة التسجيل</h2></div><div>التاريخ: ${new Date().toLocaleDateString("ar-IQ")}<br/>العدد: ____</div></div>
<h1 style="text-align:center;margin:24px 0">م / ${esc(WARNING_LABELS[r.level])}</h1>
<p>إلى الطالب/ة: <b>${esc(r.full_name)}</b> — المرحلة ${esc(r.stage ?? "")} ${r.section ? `— شعبة ${esc(r.section)}` : ""}</p>
<p>استناداً إلى تعليمات وزارة التعليم العالي والبحث العلمي الخاصة بالدوام والغياب، نُعلمكم بأن نسبة غيابكم غير المبرر في مادة <b>${esc(r.course_name)}</b> (${esc(r.course_code)}) قد بلغت <b>${esc(r.absence_pct)}%</b> من مجموع الساعات المقررة البالغة ${esc(r.total_hours)} ساعة، أي ما يعادل ${esc(r.absent_hours)} ساعة غياب.</p>
<p>${r.level === "barred" ? "وعليه تقرر <b>ترقين قيدكم / فصلكم من المادة</b> وحرمانكم من أداء الامتحان النهائي فيها." : "لذا نوجه لكم هذا الإنذار، علماً أن تجاوز نسبة 10% يؤدي إلى الحرمان من الامتحان في المادة."}</p>
<p>للتفضل بالاطلاع ... مع التقدير.</p>
<div class="sign"><div>مسؤول شعبة التسجيل<br/><br/>التوقيع: ________</div><div>رئيس القسم<br/><br/>التوقيع: ________</div></div>
<p class="foot">نسخة منه إلى: ملف الطالب / شعبة التسجيل</p></div>`,
      )
      .join("");
    printDocument("كتب الإنذارات", html);
  }

  function excel() {
    exportExcel(
      "الإنذارات",
      "الإنذارات",
      ["الطالب", "اسم المستخدم", "القسم", "المرحلة", "الشعبة", "المادة", "ساعات الغياب", "الساعات الكلية", "النسبة %", "المستوى"],
      rows.map((r) => [r.full_name, r.username, deptName.get(r.department_id ?? "") ?? "", r.stage, r.section, r.course_name, r.absent_hours, r.total_hours, r.absence_pct, WARNING_LABELS[r.level]]),
    );
  }

  return (
    <div>
      <PageHeader
        title={isStudent ? "سجل الغياب والإنذارات" : "نظام الإنذارات الذكي"}
        description="تُحتسب النسبة من مجموع الساعات الوزارية للمادة: 3% تنبيه · 5% إنذار أولي · 7% إنذار نهائي · 10% ترقين قيد"
        actions={
          !isStudent && (
            <>
              <Button variant="outline" onClick={excel} disabled={!rows.length}><Download className="ml-1 h-4 w-4" /> Excel</Button>
              <Button onClick={() => letters(rows)} disabled={!rows.length}><FileText className="ml-1 h-4 w-4" /> كتب الإنذار PDF</Button>
            </>
          )
        }
      />
      {!isStudent && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {WARNING_THRESHOLDS.slice().reverse().map((t) => (
            <StatCard key={t.level} label={`${WARNING_LABELS[t.level]} (≥${t.pct}%)`} value={count(t.level)} icon={ShieldAlert} tone={t.level === "barred" || t.level === "final" ? "destructive" : "brass"} />
          ))}
        </div>
      )}
      <Panel>
        {!isStudent && (
          <div className="mb-4 grid max-w-xl gap-2 sm:grid-cols-2">
            <NativeSelect value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">كل المستويات</option>
              {WARNING_THRESHOLDS.map((t) => <option key={t.level} value={t.level}>{WARNING_LABELS[t.level]}</option>)}
            </NativeSelect>
            <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">كل الأقسام</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </div>
        )}
        {rows.length === 0 ? <Empty icon={ShieldAlert} text={isStudent ? "لا يوجد غياب مسجل" : "لا توجد حالات"} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-right text-xs text-muted-foreground">
                {!isStudent && <th className="p-2">الطالب</th>}<th className="p-2">المادة</th><th className="p-2">غياب (ساعة)</th><th className="p-2">مُجاز</th><th className="p-2">النسبة</th><th className="p-2">المستوى</th>{!isStudent && <th />}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.student_id}-${r.course_id}`} className="border-b">
                    {!isStudent && <td className="p-2"><b className="text-foreground">{r.full_name}</b><div className="text-xs text-muted-foreground">{deptName.get(r.department_id ?? "")} · م{r.stage}</div></td>}
                    <td className="p-2">{r.course_name}</td>
                    <td className="p-2">{r.absent_hours} / {r.total_hours}</td>
                    <td className="p-2">{r.excused_hours}</td>
                    <td className="p-2 font-bold">{r.absence_pct}%</td>
                    <td className="p-2"><Badge variant={WARNING_BADGE[r.level]}>{WARNING_LABELS[r.level]}</Badge></td>
                    {!isStudent && <td className="p-2">{r.level !== "none" && <Button size="sm" variant="ghost" onClick={() => letters([r])}><FileText className="h-4 w-4" /></Button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
