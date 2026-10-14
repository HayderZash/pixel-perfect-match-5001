import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "@/lib/prefs";
import { PageHeader, Panel } from "@/components/app/kit";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageHead("الإعدادات", "المظهر وحجم الخط والتباين والإشعارات."),
  component: Settings,
});

function Settings() {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => setP(loadPrefs()), []);
  const update = (patch: Partial<Prefs>) => {
    const next = { ...p, ...patch };
    setP(next);
    savePrefs(next);
  };
  return (
    <div>
      <PageHeader title="الإعدادات" description="تُحفظ على هذا الجهاز" />
      <div className="grid max-w-2xl gap-4">
        <Panel title="المظهر">
          <div className="flex gap-2">
            <Button variant={p.theme === "light" ? "default" : "outline"} onClick={() => update({ theme: "light" })}><Sun className="ml-1 h-4 w-4" /> فاتح</Button>
            <Button variant={p.theme === "dark" ? "default" : "outline"} onClick={() => update({ theme: "dark" })}><Moon className="ml-1 h-4 w-4" /> داكن</Button>
          </div>
        </Panel>
        <Panel title={`حجم الخط — ${Math.round(p.fontScale * 100)}%`}>
          <Slider min={0.85} max={1.3} step={0.05} value={[p.fontScale]} onValueChange={(v) => update({ fontScale: v[0] ?? 1 })} />
        </Panel>
        <Panel>
          <label className="flex items-center justify-between text-sm font-semibold text-foreground">تباين عالٍ <Switch checked={p.contrast} onCheckedChange={(v) => update({ contrast: v })} /></label>
          <label className="mt-4 flex items-center justify-between text-sm font-semibold text-foreground">إشعارات الرسائل الجديدة <Switch checked={p.notify} onCheckedChange={(v) => update({ notify: v })} /></label>
        </Panel>
      </div>
    </div>
  );
}
