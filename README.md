# AttendanceFlow — Team Attendance Management

AttendanceFlow is a shared attendance system designed for large teams. It is no longer dependent on browser-only localStorage for its core records.

## Features

- Secure email/password authentication.
- Team-based multi-user architecture.
- Owner, admin, and member roles.
- Add a large number of people.
- Person photos are optional.
- Upload a photo from the local device.
- Take a photo directly through the browser camera.
- Add attendance dates/columns.
- Mark each person Present or Absent with one click.
- Empty → Present ✓ → Absent ✕ → Empty cycle.
- PostgreSQL persistence.
- Supabase Storage for profile photos.
- Row Level Security for team data isolation.
- Supabase Realtime for attendance changes.
- Responsive Tailwind UI.
- HTML5 Canvas ambient background.
- CSS3 glass UI, liquid-style buttons, and circular cursor.
- No sample people are inserted automatically.

## Architecture

Frontend: Vite + HTML5 + CSS3 + Tailwind CDN + JavaScript.

Backend: Supabase Auth + PostgreSQL + Storage + Realtime + Row Level Security.

Database tables:
- teams
- team_members
- people
- attendance_dates
- attendance

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local`.
5. Fill in:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Do not put a Supabase service-role key in frontend code.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite address printed by the terminal.

## Camera

The camera feature uses the browser MediaDevices API. Camera permission is requested only when the user chooses **Take with camera**. Browser camera access requires a secure context such as HTTPS or localhost.

## Photo behavior

Photos are optional. A person can be saved without any photo. If a photo is supplied, it is stored in the Supabase `avatars` bucket and linked to that person's database record.

## Large-team behavior

Attendance is stored centrally in PostgreSQL, so authorized team members can work on the same attendance register instead of each browser having its own copy. Realtime subscriptions refresh connected dashboards when attendance records change.

## Deployment

Build:

```
npm run build
```

Deploy the generated `dist` directory to a static host and configure the same environment variables there. Use HTTPS in production so browser camera access works reliably.

## Project structure

```
Attendance-system/
├── index.html
├── src/
│   ├── main.js
│   └── style.css
├── supabase/
│   └── schema.sql
├── .env.example
├── package.json
├── README.md
└── LICENSE
```
