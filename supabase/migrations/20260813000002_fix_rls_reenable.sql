-- INCIDENTE DE SEGURIDAD · 2026-08-09
-- Supabase Advisor detectó 34 tablas en public con RLS DESHABILITADO
-- pero con policies definidas. El anon key (público en el bundle web) puede
-- leer/escribir esas tablas sin restricción — data expuesta.
--
-- Causa raíz desconocida (aún) — Diagnóstico:
--   - Las 17 tablas nuevas de F19-1 (att_rentas, tours, etc.) NO están afectadas.
--   - Las tablas usuarios y otras NO están afectadas.
--   - Las afectadas son tablas VIEJAS de fases 4-18 (att_*, caja_*, finanzas, catalogos).
--
-- Hipótesis (sin confirmar):
--   H1: Supabase Studio deshabilitó RLS al re-ejecutar F19-1 tras el error
--       de update_updated_at_column (rollback parcial que no debería pasar
--       pero pasó — sospechoso).
--   H2: Alguna acción manual en Supabase Studio (click accidental?).
--   H3: Cambio de behavior del "Run without RLS" del SQL Editor.
--
-- Este fix re-habilita RLS en las 34 tablas afectadas. Las policies ya existen
-- (num_policies >= 1 en el diagnóstico), así que solo hay que activar RLS
-- para que se apliquen.
--
-- IDEMPOTENTE. Aplicar en Supabase Studio SQL Editor.
-- Post-aplicación: re-correr diag-rls-status.sql para verificar 0 tablas
-- en estado inseguro.

BEGIN;

do $$
declare
  t text;
  affected_tables text[] := array[
    'att_hoteles',
    'att_pins',
    'att_restaurantes',
    'att_tickets',
    'att_viajes',
    'audit_log',
    'caja_chica_liquidaciones',
    'caja_chica_vales',
    'cea_todos',
    'directorio',
    'documentos',
    'empleados',
    'entidades',
    'evento_religioso',
    'eventos',
    'kit_items',
    'lavanderia',
    'miel_constancias',
    'miembros_board',
    'notas',
    'pagos',
    'perfil_familia',
    'perfil_fechas',
    'perfil_vehiculos',
    'perfiles',
    'proveedores',
    'reintegros',
    'tareas',
    'tarjetas_credito',
    'tc_consumos',
    'tipos_pago',
    'viaje_checklist',
    'viajes',
    'vouchers'
  ];
begin
  foreach t in array affected_tables loop
    -- alter table … enable row level security es idempotente
    -- (no falla si ya está enabled).
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

COMMIT;

-- Forzar reload del schema cache de PostgREST (invariante 2 · CLAUDE.md §4).
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICACIÓN POST-APLICACIÓN
-- ============================================================
-- Correr después del RUN y esperar 0 filas:
--
--   select c.relname as tabla, c.relrowsecurity as rls_enabled
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and c.relkind = 'r'
--     and c.relrowsecurity = false
--     and exists (
--       select 1 from pg_policies p
--       where p.schemaname='public' and p.tablename=c.relname
--     );
--   -- Esperado: 0 filas.
--
-- También en Supabase Studio → Advisor → Security: los warnings
-- "Policy Exists RLS Disabled" deberían desaparecer todos.
