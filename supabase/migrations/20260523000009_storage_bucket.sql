-- Phase 2 - Migration 0009
-- Storage bucket para los documentos (reemplaza los base64 del HTML original).

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
