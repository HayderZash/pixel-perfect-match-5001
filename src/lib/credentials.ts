import QRCode from "qrcode";
import { docHeader, esc, printDocument } from "./exporters";
import { ROLE_LABELS, type AppRole } from "./roles";

export type Credential = { full_name: string; username: string; password: string; role: AppRole; qr_token: string };

export function qrUrl(token: string) {
  return `${window.location.origin}/qr?t=${encodeURIComponent(token)}`;
}

/** Print account cards (name, username, password, QR login code) as a PDF. */
export async function printCredentials(list: Credential[], title = "بطاقات دخول الحسابات") {
  const cards = await Promise.all(
    list.map(async (c) => {
      const img = await QRCode.toDataURL(qrUrl(c.qr_token), { margin: 1, width: 220 });
      return `<div class="card"><img src="${img}" alt="QR"/><div>
<b>${esc(c.full_name)}</b><br/>${esc(ROLE_LABELS[c.role] ?? "")}<br/>
اسم المستخدم: <span class="mono">${esc(c.username)}</span><br/>
كلمة المرور: <span class="mono">${esc(c.password || "—")}</span><br/>
<small>امسح الرمز للدخول المباشر</small></div></div>`;
    }),
  );
  printDocument(
    title,
    `${docHeader(title, `عدد الحسابات: ${list.length}`)}<div class="cards">${cards.join("")}</div>
<p class="foot">يرجى الحفاظ على سرية هذه البيانات وتغيير كلمة المرور بعد أول دخول.</p>`,
  );
}
