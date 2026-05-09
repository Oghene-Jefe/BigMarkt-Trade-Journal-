-- =============================================================================
-- 0004_storage_policies.sql
-- Both buckets PRIVATE. Per-user CRUD scoped by path prefix (auth.uid()/...).
-- Public sharing of trade screenshots happens through signed URLs minted
-- server-side, never via storage.objects.getPublicUrl on a public bucket.
-- =============================================================================

-- Create buckets if missing, force them private.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

insert into storage.buckets (id, name, public)
values ('trade-charts', 'trade-charts', false)
on conflict (id) do update set public = false;

-- Drop prior policies on storage.objects scoped to our buckets (idempotent).
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'bm_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Path convention: <auth.uid()>/<filename>. We enforce it via the policy.
create policy "bm_avatars_owner_rw"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bm_charts_owner_rw"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'trade-charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'trade-charts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No anon SELECT policy. To share a chart, the server mints a signed URL
-- with a short TTL after checking the trade's visibility. See
-- web/lib/storage.ts (signTradeChart).
