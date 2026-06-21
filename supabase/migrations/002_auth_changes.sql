-- Auth migration: align Supabase schema with Clerk authentication.
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
--
-- Clerk user IDs are strings in the format user_xxxxxxxxxxxxxxxxxxxxxxxxxx (not UUIDs).
-- This migration ensures the websites.user_id column accepts text values and
-- adds a user_id column to published_sites for future ownership tracking.

-- 1. Make websites.user_id a text column so it accepts Clerk user IDs.
--    USING clause handles the case where it is currently typed as uuid.
ALTER TABLE websites
  ALTER COLUMN user_id TYPE text USING user_id::text;

-- 2. Add user_id to published_sites (nullable — publish still works anonymously
--    for now; the API layer will populate this once auth is wired on the frontend).
ALTER TABLE published_sites
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS published_sites_user_id_idx
  ON published_sites (user_id);

-- 3. Tighten RLS on websites.
--    The previous policy allowed any anon request to read/write any row.
--    With Clerk auth enforced at the API layer using the anon key, we keep
--    the permissive anon policy for now (API routes are the security gate).
--    These comments document the intended tightening path when a service role
--    key is introduced:
--
--    DROP POLICY IF EXISTS "Allow anon full access" ON websites;
--    CREATE POLICY "websites_api_only"
--      ON websites FOR ALL TO anon
--      USING (false);  -- block direct anon access; only service role bypasses RLS
--
--    Until the service role key is wired in, the existing permissive policy remains.
--    No RLS changes are applied in this migration.

-- 4. Document the intended future policy for published_sites (already has permissive
--    insert/select policies from migration 001 — no change needed here).
