// Account management server functions. Privileged work loads the admin client
// inside handlers only, after verifying the caller's role via RLS-scoped client.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canCreateRole,
  canManageUser,
  isCollegeScoped,
  requiredLinks,
  ROLE_PREFIX,
  type AcademicRank,
  type AppRole,
} from "./roles";

export const USERNAME_DOMAIN = "uni.local";

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomString(len: number, alphabet: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
const genPassword = () => randomString(4, "ABCDEFGHJKLMNPQRSTUVWXYZ") + randomString(4, "23456789");
const genToken = () => randomString(40, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");

type Caller = { id: string; role: AppRole | null; college_id: string | null; department_id: string | null };

async function loadCaller(supabase: any, userId: string): Promise<Caller> {
  const [{ data: roleRow }, { data: prof }] = await Promise.all([
    supabase.rpc("user_role", { _user_id: userId }),
    supabase.from("profiles").select("college_id, department_id").eq("id", userId).maybeSingle(),
  ]);
  return {
    id: userId,
    role: (roleRow as AppRole | null) ?? null,
    college_id: prof?.college_id ?? null,
    department_id: prof?.department_id ?? null,
  };
}

// ---------- Bootstrap the system admin from server secrets (idempotent) ----------
export const ensureSystemAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const email = process.env["SYSTEM_ADMIN_EMAIL"];
  const password = process.env["SYSTEM_ADMIN_PASSWORD"];
  if (!email || !password) return { ok: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "system_admin");
  if ((count ?? 0) > 0) return { ok: true };
  let userId: string | undefined;
  const created = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.data.user?.id;
  if (!userId) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  }
  if (!userId) return { ok: false };
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, username: "sysadmin", full_name: "ادمن النظام", email });
  await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "system_admin" }, { onConflict: "user_id,role" });
  return { ok: true };
});

// ---------- Create accounts (single or batch) ----------
export type NewUserInput = {
  full_name: string;
  username?: string | null;
  password?: string | null;
  role: AppRole;
  college_id?: string | null;
  department_id?: string | null;
  stage?: number | null;
  section?: string | null;
  sub_group?: string | null;
  academic_rank?: AcademicRank | null;
  phone?: string | null;
};
export type CreatedUser = {
  full_name: string;
  username: string;
  password: string;
  role: AppRole;
  qr_token: string;
  error?: string;
};

export const createUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { users: NewUserInput[] }) => {
    if (!Array.isArray(input?.users) || input.users.length === 0) throw new Error("لا توجد حسابات");
    if (input.users.length > 500) throw new Error("الحد الأقصى 500 حساب في الدفعة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: CreatedUser[] = [];
    for (const u of data.users) {
      const full_name = String(u.full_name ?? "").trim();
      const base: CreatedUser = { full_name, username: "", password: "", role: u.role, qr_token: "" };
      try {
        if (!full_name) throw new Error("الاسم مطلوب");
        if (!canCreateRole(caller.role, u.role)) throw new Error("لا تملك صلاحية إنشاء هذا النوع");
        const college_id = caller.role && isCollegeScoped(caller.role) ? caller.college_id : (u.college_id ?? null);
        if (caller.role && isCollegeScoped(caller.role) && !college_id) throw new Error("حسابك غير مرتبط بكلية");
        const need = requiredLinks(u.role);
        if (need.college && !college_id) throw new Error("يجب اختيار الكلية لهذا الحساب");
        if (need.department && !u.department_id) throw new Error("يجب اختيار القسم لهذا الحساب");
        if (u.department_id) {
          const { data: d } = await supabaseAdmin.from("departments").select("college_id").eq("id", u.department_id).maybeSingle();
          if (!d || d.college_id !== college_id) throw new Error("القسم لا يتبع الكلية المختارة");
        }
        let username = String(u.username ?? "").trim().toLowerCase();
        if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error("اسم المستخدم: أحرف إنجليزية وأرقام فقط");
        if (!username) username = `${ROLE_PREFIX[u.role]}${randomString(6, "0123456789")}`;
        const password = String(u.password ?? "").trim() || genPassword();
        if (password.length < 6) throw new Error("كلمة المرور قصيرة");
        const email = `${username}@${USERNAME_DOMAIN}`;
        const { data: cu, error: ce } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (ce || !cu.user) throw new Error(ce?.message?.includes("already") ? "اسم المستخدم مستخدم مسبقاً" : (ce?.message ?? "فشل الإنشاء"));
        const id = cu.user.id;
        const { error: pe } = await supabaseAdmin.from("profiles").insert({
          id,
          username,
          full_name,
          email,
          college_id,
          department_id: u.department_id || null,
          stage: u.stage ? Number(u.stage) : null,
          section: u.section || null,
          sub_group: u.sub_group || null,
          academic_rank: u.academic_rank || null,
          phone: u.phone || null,
        });
        if (pe) {
          await supabaseAdmin.auth.admin.deleteUser(id);
          throw new Error(pe.message.includes("username") ? "اسم المستخدم مستخدم مسبقاً" : pe.message);
        }
        await supabaseAdmin.from("user_roles").insert({ user_id: id, role: u.role });
        const qr_token = genToken();
        await supabaseAdmin.from("qr_login_tokens").insert({ token_hash: await sha256(qr_token), user_id: id });
        results.push({ ...base, username, password, qr_token });
      } catch (e) {
        results.push({ ...base, error: e instanceof Error ? e.message : "خطأ" });
      }
    }
    const ok = results.filter((r) => !r.error).length;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: caller.id,
      action: "create_users",
      details: { created: ok, failed: results.length - ok },
    });
    return results;
  });

async function assertCanManage(supabase: any, caller: Caller, targetId: string) {
  const [{ data: roleRow }, { data: prof }] = await Promise.all([
    supabase.rpc("user_role", { _user_id: targetId }),
    supabase.from("profiles").select("college_id").eq("id", targetId).maybeSingle(),
  ]);
  const target = { id: targetId, role: (roleRow as AppRole | null) ?? null, college_id: prof?.college_id ?? null };
  if (!canManageUser(caller, target)) throw new Error("لا تملك صلاحية إدارة هذا الحساب");
}

// ---------- Update an account ----------
export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      full_name?: string;
      college_id?: string | null;
      department_id?: string | null;
      stage?: number | null;
      section?: string | null;
      sub_group?: string | null;
      academic_rank?: AcademicRank | null;
      phone?: string | null;
      is_profile_locked?: boolean;
      is_active?: boolean;
      new_password?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.supabase, context.userId);
    await assertCanManage(context.supabase, caller, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, new_password, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v === "" ? null : v;
    if (caller.role && isCollegeScoped(caller.role)) patch["college_id"] = caller.college_id;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch as never).eq("id", id);
      if (error) throw new Error(error.message);
    }
    if (new_password) {
      if (new_password.length < 6) throw new Error("كلمة المرور قصيرة");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: new_password });
      if (error) throw new Error(error.message);
    }
    if (data.is_active !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: data.is_active ? "none" : "876000h" });
    }
    await supabaseAdmin.from("audit_logs").insert({ actor_id: caller.id, action: "update_user", details: { id, fields: Object.keys(patch) } });
    return { ok: true };
  });

// ---------- Re-issue QR login tokens (and fresh passwords) for printing ----------
export const reissueCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[]; resetPassword?: boolean }) => {
    if (!Array.isArray(input?.ids) || input.ids.length === 0 || input.ids.length > 500) throw new Error("قائمة غير صالحة");
    return input;
  })
  .handler(async ({ data, context }) => {
    const caller = await loadCaller(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: CreatedUser[] = [];
    for (const id of data.ids) {
      await assertCanManage(context.supabase, caller, id);
      const { data: p } = await supabaseAdmin.from("profiles").select("full_name, username").eq("id", id).maybeSingle();
      const { data: r } = await supabaseAdmin.rpc("user_role", { _user_id: id });
      let password = "";
      if (data.resetPassword) {
        password = genPassword();
        await supabaseAdmin.auth.admin.updateUserById(id, { password });
      }
      await supabaseAdmin.from("qr_login_tokens").delete().eq("user_id", id);
      const qr_token = genToken();
      await supabaseAdmin.from("qr_login_tokens").insert({ token_hash: await sha256(qr_token), user_id: id });
      out.push({ full_name: p?.full_name ?? "", username: p?.username ?? "", password, role: r as AppRole, qr_token });
    }
    return out;
  });

// ---------- QR login (public): exchange a QR token for a one-time sign-in token ----------
export const qrLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (typeof input?.token !== "string" || input.token.length < 20 || input.token.length > 100) throw new Error("رمز غير صالح");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("qr_login_tokens")
      .select("user_id")
      .eq("token_hash", await sha256(data.token))
      .maybeSingle();
    if (!row) throw new Error("رمز QR غير صالح أو منتهي");
    const { data: prof } = await supabaseAdmin.from("profiles").select("is_active").eq("id", row.user_id).maybeSingle();
    if (prof && !prof.is_active) throw new Error("الحساب معطّل");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = u.user?.email;
    if (!email) throw new Error("الحساب غير موجود");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link.properties?.hashed_token) throw new Error("تعذر تسجيل الدخول");
    return { token_hash: link.properties.hashed_token };
  });

// ---------- Self profile update (respects lock) ----------
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name?: string; phone?: string | null; avatar_url?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("is_profile_locked")
      .eq("id", context.userId)
      .maybeSingle();
    if (prof?.is_profile_locked) throw new Error("تعديل الملف الشخصي مقفل من قبل الادمن");
    const patch: Record<string, unknown> = {};
    if (data.full_name !== undefined) {
      const n = data.full_name.trim();
      if (n.length < 3 || n.length > 120) throw new Error("الاسم غير صالح");
      patch["full_name"] = n;
    }
    if (data.phone !== undefined) patch["phone"] = data.phone?.slice(0, 30) || null;
    if (data.avatar_url !== undefined) patch["avatar_url"] = data.avatar_url?.slice(0, 500) || null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update(patch as never).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
