-- Apply schema changes when production has push disabled (NODE_ENV=production).
-- Run on the VPS after pulling code that adds new Payload fields:
--
--   cd /var/www/astropayload
--   psql "$DATABASE_URI" -f apps/payload/scripts/sync-prod-schema.sql
--
-- Safe to re-run (IF NOT EXISTS).

-- Tenants: blog import timestamp (auto-import on first publish)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS blog_imported_from_repo_at timestamptz;

-- Tenants: .md vs .mdx for publish sync output
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS blog_file_extension varchar DEFAULT 'md';

-- Users: API keys (auth.useAPIKey in Users collection)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS enable_a_p_i_key boolean DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS api_key varchar;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS api_key_index varchar;

CREATE INDEX IF NOT EXISTS users_api_key_index_idx ON users (api_key_index);
