# LearnQuest — Fixed & Vercel-Ready

## What was fixed

### Bugs
- **Progress query** now filters by `student_id` so students only see their own progress (not all students' combined)
- **Single-device check** is now properly awaited on initial load before loading state clears
- **Deactivated mid-session** — periodic 30-second check logs out deactivated students without requiring a page refresh
- **sort_order** is automatically assigned when adding a lesson (max existing + 1 per subject/class)

### Missing features added
- ✅ **Forgot password** flow on the login page (sends Supabase reset email)
- ✅ **Edit lesson** — pencil icon opens a dialog to update title, URL, notes
- ✅ **Delete student account** — permanently removes auth user + profile (with confirmation dialog)
- ✅ **Student search** — real-time name search in the Students tab
- ✅ **Lesson filters** — filter by subject and/or class in the Lessons tab
- ✅ **Enrollment code expiry** — date picker now sets `expires_at` in the DB
- ✅ **Badge management empty state** — friendly message when no badges exist
- ✅ **Skeleton loaders** on all tables and cards

### Security fixes
- **Admin route guard** (`AdminRoute`) — non-admins navigating to `/admin` are hard-redirected, not just shown a spinner
- **`remove_from_class`** now force-logs the student out server-side immediately
- **Edge function** now uses `SUPABASE_ANON_KEY` (not `PUBLISHABLE_KEY`) to verify the caller JWT correctly
- **`delete_user` action** added to edge function — deletes auth user + profile safely server-side
- **Deleted student** is removed from local state immediately so admin sees the change without waiting for a refetch

### UX
- Confirmation dialogs on all destructive actions (delete lesson, delete student, remove from class, revoke admin)
- Admin grant now requires `window.confirm` with the person's name
- Loading skeletons on all tables (students, lessons, codes, activity)
- Lesson player has a "Back to Dashboard" button in the sidebar
- Mobile-responsive: hidden table columns on small screens, actions wrap cleanly
- Friendly auth error messages ("Incorrect email or password" instead of raw Supabase errors)

### Vercel deployment
- `lovable-tagger` removed from `vite.config.ts` and `package.json` (build-time dependency that only works in Lovable)
- `vercel.json` added with SPA rewrite rule so React Router paths work on Vercel
- `.env.example` included for reference

---

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Import the repo in [vercel.com](https://vercel.com)
3. Set these environment variables in Vercel project settings:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```
4. Deploy — Vercel will run `npm run build` automatically

## Local dev

```bash
cp .env.example .env.local
# Fill in your Supabase values
npm install
npm run dev
```

## Supabase edge function

The `admin-actions` function needs to be deployed to Supabase:
```bash
supabase functions deploy admin-actions
```

Make sure `delete_user` cascade deletes are set up in your DB with FK constraints on:
- `student_progress.student_id → profiles.user_id`
- `student_badges.student_id → profiles.user_id`
- `login_activity.user_id → profiles.user_id`
- `active_sessions.user_id → profiles.user_id`
