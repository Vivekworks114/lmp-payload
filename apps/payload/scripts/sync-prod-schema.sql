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

-- Users: TOTP 2FA (payload-totp plugin)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret varchar;

-- Media: per-tenant R2 key prefix (set by Media beforeOperation hook + storage-s3)
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS prefix varchar;

-- GitHub credentials (encrypted PATs for external client repos)
CREATE TABLE IF NOT EXISTS github_credentials (
  id serial PRIMARY KEY,
  label varchar NOT NULL,
  github_owner varchar,
  token_last4 varchar,
  token_encrypted varchar,
  notes varchar,
  last_validated_at timestamptz,
  last_validation_error varchar,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS github_credential_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_github_credential_id_fk'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_github_credential_id_fk
      FOREIGN KEY (github_credential_id) REFERENCES github_credentials (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Payload document locking / preferences need a rel column per collection.
ALTER TABLE payload_locked_documents_rels
  ADD COLUMN IF NOT EXISTS github_credentials_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_github_credentials_fk'
  ) THEN
    ALTER TABLE payload_locked_documents_rels
      ADD CONSTRAINT payload_locked_documents_rels_github_credentials_fk
      FOREIGN KEY (github_credentials_id) REFERENCES github_credentials (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_github_credentials_id_idx
  ON payload_locked_documents_rels (github_credentials_id);

ALTER TABLE IF EXISTS payload_preferences_rels
  ADD COLUMN IF NOT EXISTS github_credentials_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payload_preferences_rels_github_credentials_fk'
  ) THEN
    ALTER TABLE payload_preferences_rels
      ADD CONSTRAINT payload_preferences_rels_github_credentials_fk
      FOREIGN KEY (github_credentials_id) REFERENCES github_credentials (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payload_preferences_rels_github_credentials_id_idx
  ON payload_preferences_rels (github_credentials_id);
