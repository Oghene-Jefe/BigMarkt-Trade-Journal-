-- 0041_ea_tokens_signing_secret.sql
-- Add per-token signing secret columns for the EA ingest v2 replay-protection
-- protocol (see docs/ea-replay-protocol.md). The secret itself is stored
-- encrypted-at-rest using AES-256-GCM; the master key lives in the
-- EA_SIGNING_SECRET_ENCRYPTION_KEY env var, never in the database.
--
-- Legacy tokens created before this migration have NULL ciphertext fields —
-- they keep working in v1 mode until the EA_INGEST_V1_CUTOFF_AT date.
-- /ea-setup surfaces a "legacy / update needed" badge for those rows.

alter table public.ea_tokens
  add column if not exists signing_secret_ciphertext text,
  add column if not exists signing_secret_iv text,
  add column if not exists signing_secret_tag text,
  add column if not exists signing_secret_key_version integer;

comment on column public.ea_tokens.signing_secret_ciphertext is
  'Base64-encoded AES-256-GCM ciphertext of the per-token HMAC signing '
  'secret. NULL on legacy tokens created before migration 0041.';
comment on column public.ea_tokens.signing_secret_iv is
  'Base64-encoded 12-byte IV used to encrypt signing_secret_ciphertext.';
comment on column public.ea_tokens.signing_secret_tag is
  'Base64-encoded 16-byte GCM auth tag for signing_secret_ciphertext.';
comment on column public.ea_tokens.signing_secret_key_version is
  'Master-key version used at encrypt time. Allows future master-key '
  'rotation without re-encrypting all rows in one shot.';
