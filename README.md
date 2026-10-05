# AttendanceFlow — Team Attendance Management

AttendanceFlow is a serious, shared attendance system for large teams. Core attendance records live in Supabase PostgreSQL rather than browser-only storage.

## Frontend

- Vite + JavaScript
- HTML5 Canvas ambient motion
- CSS3 glassmorphism and liquid buttons
- Responsive dashboard
- Premium 3D-style landing page
- Animated capability ticker
- Branded AttendanceFlow logo + favicon
- Custom circular cursor on pointer devices

## Real backend

AttendanceFlow uses:

- Supabase Auth for email/password accounts
- PostgreSQL for teams, people, dates and attendance
- Row Level Security (RLS) for team isolation
- Supabase Storage for optional profile photos
- Private photo bucket with signed URLs
- Supabase Realtime for people, dates and attendance changes
- Database-side validation for team ownership of attendance records
- Audit events for people, dates and attendance changes
- Automatic cleanup of attendance marks when an attendance date is deleted

Database tables:

- \`teams\`
- \`team_members\`
- \`people\`
- \`attendance_dates\`
- \`attendance\`
- \`audit_events\`

## Photo + camera

A person can be created with no photo, with a photo uploaded from the device, or with a photo captured through the browser camera.

Production camera access requires HTTPS. The Vercel deployment provides a secure context.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Copy the complete contents of \`supabase/schema.sql\` from this repository.
4. Run the updated schema once. It is written to be safe to re-run because it replaces policies/functions/triggers where necessary.
5. In **Project Settings → API**, copy the Project URL and the publishable/anon key.

Frontend environment variables:

\`\`\`
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
\`\`\`

Never put a Supabase service-role/secret key in frontend code or Vercel client-side variables.

## Vercel deployment

Recommended setup:

- Framework Preset: **Vite**
- Build Command: \`npm run build\`
- Output Directory: \`dist\`
- Install Command: \`npm install\`

Set the two \`VITE_\` environment variables in the Vercel project and redeploy after changing them.

## Local development

\`\`\`
npm install
npm run dev
\`\`\`

## Attendance behavior

Each cell follows:

\`empty → present → absent → empty\`

A removed person is soft-deactivated so historical attendance is preserved.

Only owners/admins can remove people or dates in the interface. Team members can work with attendance according to the database policies.

## Project structure

\`\`\`
Attendance-system/
├── index.html
├── public/
│   └── attendanceflow-logo.svg
├── src/
│   ├── main.js
│   └── style.css
├── supabase/
│   └── schema.sql
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
\`\`\`
