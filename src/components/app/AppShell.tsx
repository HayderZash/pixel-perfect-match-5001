import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { ROLE_LABELS, type Feature } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loading } from "./kit";

type NavItem = { to: string; feature: Feature; label: string; icon: LucideIcon };
export const NAV: NavItem[] = [
  { to: "/dashboard", feature: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/users", feature: "users", label: "إدارة الحسابات", icon: Users },
  { to: "/structure", feature: "structure", label: "الكليات والأقسام", icon: Building2 },
  { to: "/courses", feature: "courses", label: "المواد الدراسية", icon: BookOpen },
  { to: "/timetable", feature: "timetable", label: "الجدول الدراسي", icon: CalendarDays },
  { to: "/attendance", feature: "attendance", label: "تسجيل الحضور", icon: ClipboardCheck },
  { to: "/warnings", feature: "warnings", label: "الإنذارات", icon: ShieldAlert },
  { to: "/lectures", feature: "lectures", label: "المحاضرات", icon: FileSpreadsheet },
  { to: "/library", feature: "library", label: "المكتبة المركزية", icon: Library },
  { to: "/messages", feature: "messages", label: "المراسلات", icon: MessagesSquare },
  { to: "/workload", feature: "workload", label: "النصاب التدريسي", icon: BarChart3 },
  { to: "/reports", feature: "reports", label: "القوائم الرسمية", icon: ScrollText },
  { to: "/permissions", feature: "permissions", label: "الصلاحيات", icon: KeyRound },
  { to: "/logs", feature: "logs", label: "سجل النظام", icon: ScrollText },
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { me, can } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const items = NAV.filter((n) => can(n.feature));
  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-gradient text-brass-foreground">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <div className="font-display font-extrabold">المنظومة الأكاديمية</div>
          <div className="text-xs text-sidebar-foreground/60">{me?.role ? ROLE_LABELS[me.role] : ""}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((n) => (
          <Link key={n.to} to={n.to} onClick={onNavigate} className={linkCls(path.startsWith(n.to))}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border p-3">
        <Link to="/profile" onClick={onNavigate} className={linkCls(path.startsWith("/profile"))}>
          <UserCircle className="h-4 w-4" /> الملف الشخصي
        </Link>
        <Link to="/settings" onClick={onNavigate} className={linkCls(path.startsWith("/settings"))}>
          <Settings className="h-4 w-4" /> الإعدادات
        </Link>
        <button onClick={signOut} className={cn(linkCls(false), "w-full")}>
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, isLoading } = useMe();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">القائمة</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:mr-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="mr-auto flex items-center gap-3">
            <div className="text-left">
              <div className="text-sm font-bold text-foreground">{me?.profile.full_name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {me?.profile.username}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {me?.profile.full_name?.slice(0, 1)}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          {isLoading ? <Loading /> : !me ? <p className="text-center text-muted-foreground">تعذر تحميل الحساب.</p> : children}
        </main>
      </div>
    </div>
  );
}

/** Wrap a page body: shows a notice when the role cannot access the feature. */
export function Guard({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { can } = useMe();
  if (!can(feature)) return <p className="py-16 text-center text-muted-foreground">لا تملك صلاحية الوصول لهذه الصفحة.</p>;
  return <>{children}</>;
}
