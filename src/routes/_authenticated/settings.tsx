import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Building, Contrast, Moon, Palette, RotateCcw, Sun, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";
import { useMe } from "@/lib/me";
import { isTopAdmin } from "@/lib/roles";
import { BRANDING_KEYS, DEFAULT_BRANDING, useBranding, type Branding } from "@/lib/branding";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { logAction } from "@/lib/data";
import { Field, PageHeader, Panel, errMsg } from "@/components/app/kit";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageHead("الإعدادات", "المظهر وحجم الخط والتباين والإشعارات وهوية الجامعة."),
  component: Settings,
});

function Row({ icon: Icon, title, hint, children }: { icon: typeof Bell; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-primary" />
        <div><div className="text-sm font-semibold text-foreground">{title}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
      </div>
      {children}
    </div>
  );
}

function Settings() {
  const { me } = useMe();
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => setP(loadPrefs()), []);
  const update = (patch: Partial<Prefs>) => {
    const next = { ...p, ...patch };
    setP(next);
    savePrefs(next);
  };
  async function toggleNotify(v: boolean) {
    if (v && "Notification" in window && Notification.permission === "default") {
      const r = await Notification.requestPermission();
      if (r !== "granted") toast.info("لم يُسمح بإشعارات المتصفح؛ ستظهر التنبيهات داخل النظام فقط.");
    }
    update({ notify: v });
  }

  return (
    <div>
      <PageHeader title="الإعدادات" description="تفضيلات العرض تُحفظ على هذا الجهاز، وهوية الجامعة تُطبق على الجميع." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="المظهر وإمكانية الوصول">
          <div className="divide-y">
            <Row icon={Palette} title="السمة">
              <div className="flex gap-2">
                <Button size="sm" variant={p.theme === "light" ? "default" : "outline"} onClick={() => update({ theme: "light" })}><Sun className="ml-1 h-4 w-4" /> فاتح</Button>
                <Button size="sm" variant={p.theme === "dark" ? "default" : "outline"} onClick={() => update({ theme: "dark" })}><Moon className="ml-1 h-4 w-4" /> داكن</Button>
              </div>
            </Row>
            <div className="py-3">
              <Row icon={Type} title={`حجم الخط — ${Math.round(p.fontScale * 100)}%`} hint="يكبّر النصوص في كل الصفحات"><span /></Row>
              <Slider min={0.85} max={1.3} step={0.05} value={[p.fontScale]} onValueChange={(v) => update({ fontScale: v[0] ?? 1 })} />
              <p className="mt-3 rounded-md bg-muted p-3 text-sm text-foreground">معاينة: الحضور، الجداول، المحاضرات والإنذارات.</p>
            </div>
            <Row icon={Contrast} title="تباين عالٍ" hint="ألوان أوضح لضعاف البصر"><Switch checked={p.contrast} onCheckedChange={(v) => update({ contrast: v })} /></Row>
            <div className="pt-3"><Button variant="ghost" size="sm" onClick={() => { savePrefs(DEFAULT_PREFS); setP(DEFAULT_PREFS); }}><RotateCcw className="ml-1 h-4 w-4" /> استعادة الافتراضي</Button></div>
          </div>
        </Panel>

        <Panel title="الإشعارات">
          <div className="divide-y">
            <Row icon={Bell} title="إشعارات الرسائل الجديدة" hint="تنبيه عند وصول رسالة"><Switch checked={p.notify} onCheckedChange={toggleNotify} /></Row>
          </div>
        </Panel>

        {isTopAdmin(me?.role) && <BrandingPanel />}
      </div>
    </div>
  );
}

const LABELS: Record<keyof Branding, string> = {
  university_name: "اسم الجامعة",
  university_motto: "الشعار / العبارة التعريفية",
  academic_year: "العام الدراسي الحالي",
  current_semester: "الفصل الحالي",
  footer_note: "ملاحظة تذييل الوثائق المطبوعة",
};

function BrandingPanel() {
  const qc = useQueryClient();
  const { data } = useBranding();
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setB(data); }, [data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(BRANDING_KEYS.map((k) => ({ key: k, value: b[k].trim() || null })));
      if (error) throw new Error(error.message);
      toast.success("حُفظت هوية الجامعة");
      logAction("update_branding");
      qc.invalidateQueries({ queryKey: ["branding"] });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="هوية الجامعة (للجميع)" className="xl:col-span-2">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {BRANDING_KEYS.map((k) => (
          <Field key={k} label={LABELS[k]} className={k === "footer_note" ? "sm:col-span-2" : ""}>
            <Input value={b[k]} onChange={(e) => setB({ ...b, [k]: e.target.value })} placeholder={k === "academic_year" ? "2026-2027" : ""} />
          </Field>
        ))}
        <div className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2"><Building className="h-4 w-4" /> يظهر الاسم في القائمة الجانبية ورأس كل وثيقة مطبوعة (الجداول، الإنذارات، القوائم الرسمية).</div>
        <div className="sm:col-span-2"><Button type="submit" disabled={busy}>حفظ الهوية</Button></div>
      </form>
    </Panel>
  );
}
