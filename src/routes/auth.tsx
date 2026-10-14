import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GraduationCap, LogIn, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/kit";
import { QrScanner } from "@/components/app/QrScanner";
import { usernameToEmail } from "@/lib/me";
import { ensureSystemAdmin, qrLogin } from "@/lib/users.functions";
import campus from "@/assets/campus.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول | المنظومة الأكاديمية" },
      { name: "description", content: "سجّل الدخول باسم المستخدم وكلمة المرور أو امسح رمز QR الخاص بك." },
      { property: "og:title", content: "تسجيل الدخول | المنظومة الأكاديمية" },
      { property: "og:description", content: "سجّل الدخول باسم المستخدم وكلمة المرور أو امسح رمز QR الخاص بك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);

  const qrSignIn = useCallback(
    async (token: string) => {
      setScan(false);
      setBusy(true);
      try {
        const { token_hash } = await qrLogin({ data: { token } });
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "رمز الدخول غير صالح");
      } finally {
        setBusy(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    ensureSystemAdmin().catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("banned") ? "الحساب معطّل" : "اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-hero text-primary-foreground shadow-elevated">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-lg font-extrabold text-foreground">المنظومة الأكاديمية</div>
              <div className="text-xs text-muted-foreground">الإدارة الجامعية المتكاملة</div>
            </div>
          </Link>
          <h1 className="text-3xl font-extrabold text-foreground">أهلاً بعودتك</h1>
          <p className="mt-2 text-sm text-muted-foreground">أدخل اسم المستخدم وكلمة المرور الممنوحة لك من الجامعة.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="اسم المستخدم أو البريد">
              <Input dir="ltr" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field label="كلمة المرور">
              <Input dir="ltr" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              <LogIn className="ml-2 h-4 w-4" /> {busy ? "جارِ الدخول…" : "دخول"}
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />أو<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => setScan(true)}>
            <QrCode className="ml-2 h-4 w-4" /> قراءة الباركود
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">افتح الكاميرا أو ارفع صورة بطاقة الدخول للدخول مباشرة.</p>
          <QrScanner open={scan} onOpenChange={setScan} onToken={qrSignIn} />
        </div>
      </div>
      <div className="relative hidden overflow-hidden lg:block">
        <img src={campus} alt="الحرم الجامعي" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero opacity-70" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-primary-foreground">
          <p className="max-w-md font-display text-3xl font-extrabold leading-snug">
            الحضور، الجداول، المحاضرات والإنذارات — في منظومة واحدة.
          </p>
        </div>
      </div>
    </div>
  );
}
