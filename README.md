# OnTrack

OnTrack is a personal task and deadline tracker for desktop and Android browsers. It combines a task list, recurring schedules, calendar views, weekly analytics, and a recent activity feed.

**Windows first:** [Install the local Windows edition](setup/WINDOWS-VI.md). It opens from a Desktop/Start Menu shortcut, connects to a private Sheet, and sends native Windows reminders without Google sign-in or OneSignal. Android deployment will be handled separately.

[Hướng dẫn kết nối Google Sheet và Web Push bằng tiếng Việt](setup/README-VI.md)

[Thiết lập đăng nhập Google cho tài khoản cá nhân](setup/GOOGLE-AUTH-VI.md)

## Features

- Add and edit tasks; mark them completed, reopen them, or put them on Pending.
- Show all tasks in overdue, active, Pending, and completed groups.
- Schedule recurring tasks every N hours/days, on selected weekdays, or on a day of the month.
- View deadlines in a Monday–Sunday week and a monthly calendar.
- Explore stacked completion charts, priorities, weekly comparisons, and completion timing.
- Switch between light/dark mode and Vietnamese/English.
- Sign in with the one approved Google account, with server-verified sessions.
- Review the latest 20 data changes, including before/after values for app edits.
- Connect Google Sheets through Google Apps Script and use OneSignal Web Push for deadline reminders.

## Run locally

For the installed Windows app, run `npm ci` and `npm run windows:install`, then open **OnTrack** from its shortcut. Enter the Apps Script URL and token directly in Settings. The local host binds only to loopback and keeps connection settings outside the repository. Closing the window leaves reminder checks running; the Startup option is controlled in the app. See the [Windows guide](setup/WINDOWS-VI.md) for setup, reminders, limits, and uninstall steps.

The following commands run the web development edition:

Requirements: Node.js **22.13 or newer**, npm, and Git.

```sh
npm ci
npm run dev
```

Open the loopback URL printed by the server, normally http://127.0.0.1:5173. With no Sheet or Google auth configuration, the web development server offers a synthetic demo. Demo tasks, activity, and preferences are saved in the current browser. Demo changes do not sync between devices or write to a Sheet. Live Sheet configuration in the web edition requires Google sign-in; the installed Windows host uses its separate loopback-only access policy.

For local OAuth, copy `.dev.vars.example` to the ignored `.dev.vars` file and configure it privately. See the [Google sign-in guide](setup/GOOGLE-AUTH-VI.md) for the exact callback URL and required secrets.

```sh
npm test
npm run typecheck
npm run build
```

The domain and Apps Script fixture tests cover Vietnam-time deadlines, weekly boundaries, Pending, recurrence, reminders, conflict handling, analytics, monthly calendars, preferences, and bounded activity history. Auth tests cover Google token verification, owner restrictions, state/PKCE, session tampering, and logout CSRF protection.

## Connect your own Sheet

1. Read [the setup guide](setup/README-VI.md).
2. Replace `YOUR_SPREADSHEET_ID` in `setup/Code.gs` and the Sheet link in `app/ontrack.tsx` with your Sheet ID.
3. Install the Apps Script code, run `setupOnTrack`, and deploy its authenticated endpoint.
4. Configure `ONTRACK_SCRIPT_URL` and `ONTRACK_API_TOKEN` in the server environment. The blank [.env.example](.env.example) documents the names; copy it to an ignored local environment file only when configuring a connection.
5. Configure OneSignal separately to enable Web Push. Its API key belongs in Apps Script Properties, never in browser code.

The five-minute Apps Script scheduler creates recurring tasks and checks deadline reminders. Browser-local demo mode only processes recurrence while the app is open or refreshed. Scheduled delivery depends on service quotas, network conditions, and device settings.

## Architecture and deployment

| Location | Purpose |
| --- | --- |
| `app/` | React screens, task editor, calendar, statistics, preferences, and activity panel |
| `lib/task-core.mjs` | Shared task, recurrence, deadline, and reminder rules |
| `lib/ontrack-api.ts` | Server-side Google Apps Script proxy |
| `lib/google-auth.mjs` | Owner-only Google OAuth and signed HttpOnly sessions |
| `lib/activity-core.mjs` | Change detection and the latest-20 activity limit |
| `setup/Code.gs` | Sheet storage, edit logging, scheduler, and OneSignal delivery |
| `worker/index.ts` | Cloudflare Worker entry point |
| `tests/` | Domain tests and Apps Script fixtures |
| `scripts/windows/` | Windows installation, local host, settings storage, and native reminders |

The app uses Vinext and a Cloudflare Worker. Authentication is handled by Google OAuth in the app, independently of ChatGPT/Sites user headers. Production requires a configured Google Web OAuth Client, a single approved email, a random session secret, and a canonical HTTPS origin. Login requests only `openid email profile`; the existing Apps Script connection handles Sheet access.

After configuring your Cloudflare account, use `npm run deploy` to build and publish the generated Worker configuration. Missing auth configuration fails closed; it never exposes the live Sheet. Follow the [deployment and Google setup guide](setup/GOOGLE-AUTH-VI.md) before enabling real data. The previous owner-private Sites URL retains its separate hosting login until it is replaced by a standalone deployment.

The tracked `.openai/hosting.json` contains empty storage bindings and **no existing Site project ID**. Bundled Sites tooling is retained for build compatibility, but its local ChatGPT authentication simulation is disabled.

When changing shared domain code, regenerate the Apps Script bundle and rerun tests:

```sh
node scripts/sync-apps-script.mjs
npm test
```

## Repository notes

The initial eight implementation commits separate project scaffolding, Sheet integration, task workflows, recurrence/Pending, calendar/analytics, theme/language preferences, activity notifications, and setup documentation. Google authentication is added in later commits. Every stage is pushed independently.

This repository contains no personal task history, production Sheet ID, API tokens, or deployment credentials. Keep real configuration in ignored environment files or hosting/Apps Script secret settings. Bundled third-party components and tooling retain their included license notices.
