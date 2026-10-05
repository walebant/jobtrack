# Job Search Tracker

Finds, scores, tracks and drafts applications for NHS and UK public sector jobs.
Next.js (App Router) on Vercel, Supabase for the database and sign-in, Drizzle for the schema,
and the Anthropic API for AI work (from milestone 2).

The single-file prototype in `reference/job-tracker.html` is the reference for prompts, layout and behaviour.

## Set up

1. **Create a Supabase project** at supabase.com (London region, `eu-west-2`, is closest).
2. **Fill in `.env.local`** (copy `.env.example`). From the Supabase dashboard:
   - Project URL and anon (or publishable) key: Project Settings > API
   - Service role key: Project Settings > API (keep it secret)
   - `DATABASE_URL`: Connect > ORMs > Drizzle, **Transaction pooler** string, with your database password
3. **Create the tables:** `npm run db:migrate`
4. **Point magic links at the app** in Supabase > Authentication:
   - URL Configuration: Site URL `http://localhost:3000`, and add `http://localhost:3000/**` to Redirect URLs
     (add your Vercel URL too once deployed)
   - The default Magic Link email works as is, but the link must be opened in the same browser
     that asked for it. Optional, once custom SMTP is set up (Supabase requires it to edit templates):
     change the link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
     so a link opened on any device signs in there.
5. **Check row level security:** `npm run test:rls` (creates two throwaway users, then deletes them)
6. **Run it:** `npm run dev` and open http://localhost:3000

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run check` | Lint, type check, unit tests and production build |
| `npm test` | Unit tests |
| `npm run test:rls` | RLS tests against the real database |
| `npm run db:generate` | New migration after editing `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

## How data access works

- Every table has `user_id` (filled from the session by default) and one RLS policy: owners only.
- Request code uses `userDb(fn)` from `lib/db/user.ts`. It runs queries as the signed-in user
  with the `authenticated` role, so RLS applies even though Drizzle connects directly.
- `adminDb()` bypasses RLS. Only for migrations, tests and Phase 2 background jobs.
- Database triggers log every status change to `job_status_history`, set `submitted_at`,
  keep `updated_at` current and create a profile row for each new user.
- Child tables reference `(job_id, user_id)` together, so a row can never point at another user's job.

## Deploy (Vercel)

Import the repo in Vercel (or run `npx vercel`), add the same environment variables,
set `NEXT_PUBLIC_SITE_URL` to the Vercel URL, and add that URL to Supabase's Redirect URLs.
