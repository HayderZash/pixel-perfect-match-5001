import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ClipboardCheck, GraduationCap, ShieldAlert, BookOpen, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import campus from "@/assets/campus.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "المنظومة الأكاديمية الجامعية | الحضور والجداول والإنذارات" },
      { name: "description", content: "منظومة جامعية متكاملة لإدارة الحسابات والجداول والحضور والإنذارات والمحاضرات والمراسلات." },
      { property: "og:title", content: "المنظومة الأكاديمية الجامعية" },
      { property: "og:description", content: "منظومة جامعية متكاملة لإدارة الحسابات والجداول والحضور والإنذارات والمحاضرات والمراسلات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: ClipboardCheck, t: "حضور بنقرة واحدة", d: "يعمل حتى عند انقطاع الإنترنت مع قفل تلقائي بعد 7 أيام." },
  { icon: ShieldAlert, t: "إنذارات تلقائية", d: "3% تنبيه، 5% أولي، 7% نهائي، 10% ترقين قيد." },
  { icon: CalendarDays, t: "جدول بلا تعارضات", d: "شعب ومجموعات عملية مع منع تداخل القاعات والتدريسيين." },
  { icon: BookOpen, t: "محاضرات ومكتبة", d: "رفع وتنزيل المحاضرات والكتب والبحوث." },
  { icon: MessagesSquare, t: "مراسلات منضبطة", d: "تواصل هرمي وفق الصلاحيات الجامعية." },
  { icon: GraduationCap, t: "نصاب تدريسي", d: "مقارنة الساعات الأسبوعية بنصاب اللقب العلمي." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden bg-hero text-primary-foreground">
        <img src={campus} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="pattern-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-gradient text-brass-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
              <span className="font-display text-lg font-extrabold">المنظومة الأكاديمية</span>
            </div>
            <Button asChild variant="brass">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </div>
          <div className="max-w-2xl py-20 md:py-28">
            <h1 className="font-display text-4xl font-extrabold leading-tight md:text-6xl">إدارة أكاديمية جامعية بمعايير التعليم العالي</h1>
            <p className="mt-5 text-lg opacity-85">ست صلاحيات، جداول ذكية، حضور فوري، وإنذارات غياب تُحتسب تلقائياً من الساعات الوزارية.</p>
            <Button asChild size="lg" variant="brass" className="mt-8">
              <Link to="/auth">ابدأ الآن</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-xl border bg-card p-6 shadow-soft">
            <f.icon className="h-8 w-8 text-primary" />
            <h3 className="mt-4 text-lg font-bold text-card-foreground">{f.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">© المنظومة الأكاديمية الجامعية</footer>
    </div>
  );
}
