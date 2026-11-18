# OnTrack

OnTrack is a personal task and deadline tracker for desktop and Android browsers. It combines a task list, recurring schedules, calendar views, weekly analytics, and a recent activity feed.

[Hướng dẫn kết nối Google Sheet và Web Push bằng tiếng Việt](setup/README-VI.md)

## Features

- Add and edit tasks; mark them completed, reopen them, or put them on Pending.
- Show all tasks in overdue, active, Pending, and completed groups.
- Schedule recurring tasks every N hours/days, on selected weekdays, or on a day of the month.
- View deadlines in a Monday–Sunday week and a monthly calendar.
- Explore stacked completion charts, priorities, weekly comparisons, and completion timing.
- Switch between light/dark mode and Vietnamese/English.
- Review the latest 20 data changes, including before/after values for app edits.
- Connect Google Sheets through Google Apps Script and use OneSignal Web Push for deadline reminders.

## Run locally

Requirements: Node.js **22.13 or newer**, npm, and Git.

```sh
npm ci
npm run dev
```

Open the loopback URL printed by the server, normally http://127.0.0.1:5173. With no Sheet connection configured, the app uses synthetic demo tasks. Demo tasks, activity, and preferences are saved in the current browser. Demo changes do not sync between devices or write to a Sheet.

```sh
npm test
npm run typecheck
npm run build
```

The domain and Apps Script fixture tests cover Vietnam-time deadlines, weekly boundaries, Pending, recurrence, reminders, conflict handling, analytics, monthly calendars, preferences, and bounded activity history.

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
| `lib/activity-core.mjs` | Change detection and the latest-20 activity limit |
| `setup/Code.gs` | Sheet storage, edit logging, scheduler, and OneSignal delivery |
| `worker/index.ts` | Cloudflare Worker entry point |
| `tests/` | Domain tests and Apps Script fixtures |

This project retains its Vinext/Cloudflare Worker and Sites runtime integration. In production, the API expects authenticated user headers from the hosting platform. Deploying it on another host requires an equivalent authentication layer; do not treat a plain Worker upload as a complete authenticated deployment.

The tracked `.openai/hosting.json` contains empty storage bindings and **no existing Site project ID**. Configure your own hosting identity before publishing. The development server uses the starter's local authentication simulation, which is excluded from production builds.

When changing shared domain code, regenerate the Apps Script bundle and rerun tests:

```sh
node scripts/sync-apps-script.mjs
npm test
```

## Repository notes

The eight implementation commits separate project scaffolding, Sheet integration, task workflows, recurrence/Pending, calendar/analytics, theme/language preferences, activity notifications, and setup documentation. Every stage was pushed independently.

This repository contains no personal task history, production Sheet ID, API tokens, or deployment credentials. Keep real configuration in ignored environment files or hosting/Apps Script secret settings. Bundled third-party components and tooling retain their included license notices.
