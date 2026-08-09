-- Backfill trip_no en viajes creados ANTES de F19-1 · 2026-08-09.
--
-- F19-1 agregó la columna trip_no y un trigger que auto-genera TT-YYYY-####
-- en INSERT. Pero los viajes viejos (efqwrqe, asdfasdfas) tenían trip_no NULL.
-- Este script les asigna un correlativo usando la sequence att_viaje_seq.
--
-- Idempotente · solo actualiza los que están NULL.
-- Correr una sola vez en Supabase Studio SQL Editor.

BEGIN;

update public.att_viajes
   set trip_no = 'TT-' || to_char(coalesce(created_at, now()), 'YYYY') || '-' ||
                 lpad(nextval('public.att_viaje_seq')::text, 4, '0')
 where trip_no is null
   and deleted_at is null;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación
-- ============================================================
-- select id, trip_no, titulo, created_at
-- from public.att_viajes
-- where deleted_at is null
-- order by created_at;
