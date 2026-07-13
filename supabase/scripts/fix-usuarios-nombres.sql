-- Fix M-3 del AUDIT-2026-07-12: usuarios con nombre NULL.
-- El topbar y otros componentes renderizan `null` en el nombre → estéticamente feo.
--
-- Correr en Supabase SQL Editor.

-- 1. Ver quiénes tienen nombre NULL:
select id, nombre from public.usuarios where nombre is null;

-- 2. Fix Angeles (ajusta el ID si es distinto):
update public.usuarios
   set nombre = 'Angeles Quezada'
 where id = 'ff19eebc-d239-446e-92f7-4210fa67a60f';

-- 3. Verificar:
select id, nombre, rol from public.usuarios where id = 'ff19eebc-d239-446e-92f7-4210fa67a60f';
-- Esperado: nombre = 'Angeles Quezada'
