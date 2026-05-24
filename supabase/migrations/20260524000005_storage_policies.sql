-- Phase 3 - Migration 0005
-- Storage policies for the 'documentos' bucket.
-- Read: any authenticated user. Write: admin or asistente only.

drop policy if exists "documentos read authenticated" on storage.objects;
drop policy if exists "documentos insert admin asistente" on storage.objects;
drop policy if exists "documentos update admin asistente" on storage.objects;
drop policy if exists "documentos delete admin asistente" on storage.objects;

create policy "documentos read authenticated"
  on storage.objects for select
  using ( bucket_id = 'documentos' and auth.uid() is not null );

create policy "documentos insert admin asistente"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

create policy "documentos update admin asistente"
  on storage.objects for update
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  )
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

create policy "documentos delete admin asistente"
  on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );
