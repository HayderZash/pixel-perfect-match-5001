import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { qrLogin } from "@/lib/users.functions";

export const Route = createFileRoute("/qr")({
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s["t"] === "string" ? (s["t"] as string) : "" }),
  head: () => ({
    meta: [
      { title: "الدخول برمز QR | المنظومة الأكاديمية" },
      { name: "description", content: "تسجيل دخول سريع باستخدام رمز QR المطبوع على بطاقة الحساب." },
      { property: "og:title", content: "الدخول برمز QR | المنظومة الأكاديمية" },
      { property: "og:description", content: "تسجيل دخول سريع باستخدام رمز QR المطبوع على بطاقة الحساب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrPage,
});

function QrPage() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!t) {
      setError("الرابط لا يحتوي على رمز");
      return;
    }
    (async () => {
      try {
        await supabase.auth.signOut();
        const { token_hash } = await qrLogin({ data: { token: t } });
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر الدخول");
      }
    })();
  }, [t, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <QrCode className="mx-auto h-14 w-14 text-primary" />
        {error ? (
          <>
            <h1 className="mt-4 text-xl font-bold text-foreground">{error}</h1>
            <Link to="/auth" className="mt-4 inline-block text-sm font-semibold text-primary underline">
              الدخول باسم المستخدم
            </Link>
          </>
        ) : (
          <h1 className="mt-4 text-xl font-bold text-foreground">جارِ تسجيل الدخول…</h1>
        )}
      </div>
    </div>
  );
}
