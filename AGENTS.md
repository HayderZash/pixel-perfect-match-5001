<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Accounts are created only by admins through server functions in `src/lib/users.functions.ts` (public signup is disabled); usernames map to synthetic `<username>@uni.local` emails so login is by username.
- QR login: printed cards hold a random token whose SHA-256 is stored in `qr_login_tokens`; `/qr` exchanges it for a magic-link token hash server-side. Never store raw tokens.
- The system admin is bootstrapped idempotently from the SYSTEM_ADMIN_EMAIL/PASSWORD secrets when the sign-in page loads.
- Pure business rules (roles, warnings, load, locks) live in `src/lib/roles.ts` and `src/lib/academic.ts` and are covered by `src/test/rules.test.ts`; the database re-enforces them via RLS and triggers.
- PDFs are produced through the browser print dialog (`src/lib/exporters.ts`) for correct Arabic shaping; Excel via `xlsx`.
- Attendance submissions queue in localStorage when offline (`src/lib/attendance-sync.ts`) and flush on reconnect.

- Timetables are containers (department, stage, section, shift) holding `timetable_slots` via `timetable_id`; shift windows and remaining-hours math live in `src/lib/academic.ts` so the grid, import template and tests share one rule.
- University branding lives in `app_settings` and is read through `src/lib/branding.ts`, which also feeds printed document headers.
