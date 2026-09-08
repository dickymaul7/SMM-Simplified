-- SMM Simplified — Buffer Publisher Storage
-- Additive only. Does not modify Combined tables, SMM core tables, or existing business-table RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'smm-publisher-media',
  'smm-publisher-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'smm_publisher_insert_own_folder'
  ) then
    create policy "smm_publisher_insert_own_folder"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'smm-publisher-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'smm_publisher_update_own_folder'
  ) then
    create policy "smm_publisher_update_own_folder"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'smm-publisher-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'smm-publisher-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'smm_publisher_delete_own_folder'
  ) then
    create policy "smm_publisher_delete_own_folder"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'smm-publisher-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
