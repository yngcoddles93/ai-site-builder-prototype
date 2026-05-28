# ai-site-builder-prototype

## Published sites (shareable launch)

Launching a site saves a read-only snapshot to Supabase and opens a shareable URL.

### Setup

1. Run the migration in Supabase SQL Editor:
   `supabase/migrations/001_published_sites.sql`
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your Vercel project (or local env).

### Flow

- **Launch Website** in `index.html` → `POST /api/publish-site` → opens `/site.html?id=<uuid>`
- **View published site** → `GET /api/get-published-site?id=<uuid>`

Save Project / Load Projects still use the `websites` table and are unchanged.

### Local testing without Supabase

Use a legacy localStorage id with `?test=local`:

`/site.html?id=site-test123&test=local`
