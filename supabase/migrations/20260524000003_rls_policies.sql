-- Phase 3 - Migration 0003
-- Row Level Security policies for all tables.
-- Three patterns:
--   A) Financial    -- read: admin|asistente|solo_lectura ; write: admin|asistente
--   B) Member data  -- admin|asistente see all; board_member sees own rows
--   C) Catalog      -- read: all authenticated ; write: admin
-- Special:
--   * documentos    -- read all authenticated ; write admin|asistente
--   * audit_log     -- read admin only ; no app writes (trigger uses SECURITY DEFINER)

-- ============================================================
-- Pattern A - financial tables
-- ============================================================
do $$
declare
  t text;
  finance_tables text[] := array[
    'tc_consumos',
    'reintegros',
    'caja_chica_vales',
    'caja_chica_liquidaciones',
    'pagos',
    'vouchers'
  ];
begin
  foreach t in array finance_tables loop
    execute format(
      'create policy %I on public.%I for select using ( public.auth_rol() in (''admin'',''asistente'',''solo_lectura'') )',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for all using ( public.auth_rol() in (''admin'',''asistente'') ) with check ( public.auth_rol() in (''admin'',''asistente'') )',
      t || '_modify', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern B - member-owned tables (direct miembro_id)
-- ============================================================
do $$
declare
  t text;
  member_tables text[] := array[
    'tareas',
    'viajes',
    'eventos',
    'notas',
    'perfiles'
  ];
begin
  foreach t in array member_tables loop
    execute format(
      'create policy %I on public.%I for all
        using ( public.auth_rol() in (''admin'',''asistente'') or miembro_id = public.mi_miembro_id() )
        with check ( public.auth_rol() in (''admin'',''asistente'') or miembro_id = public.mi_miembro_id() )',
      t || '_access', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern B' - sub-tables, parent-driven access
-- ============================================================

-- viaje_checklist: via viajes.miembro_id
create policy viaje_checklist_access on public.viaje_checklist for all
  using (
    public.auth_rol() in ('admin','asistente')
    or exists (
      select 1 from public.viajes v
      where v.id = viaje_checklist.viaje_id
        and v.miembro_id = public.mi_miembro_id()
    )
  )
  with check (
    public.auth_rol() in ('admin','asistente')
    or exists (
      select 1 from public.viajes v
      where v.id = viaje_checklist.viaje_id
        and v.miembro_id = public.mi_miembro_id()
    )
  );

-- perfil_vehiculos / perfil_familia / perfil_fechas: via perfiles.miembro_id
do $$
declare
  t text;
  sub_perfil_tables text[] := array['perfil_vehiculos','perfil_familia','perfil_fechas'];
begin
  foreach t in array sub_perfil_tables loop
    execute format(
      'create policy %I on public.%I for all
        using (
          public.auth_rol() in (''admin'',''asistente'')
          or exists (
            select 1 from public.perfiles p
            where p.id = %I.perfil_id and p.miembro_id = public.mi_miembro_id()
          )
        )
        with check (
          public.auth_rol() in (''admin'',''asistente'')
          or exists (
            select 1 from public.perfiles p
            where p.id = %I.perfil_id and p.miembro_id = public.mi_miembro_id()
          )
        )',
      t || '_access', t, t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern C - catalog tables (read all authenticated, write admin)
-- ============================================================
do $$
declare
  t text;
  catalog_tables text[] := array[
    'miembros_board',
    'empleados',
    'entidades',
    'autorizadores',
    'tipos_pago',
    'proveedores',
    'tarjetas_credito',
    'kit_items',
    'evento_religioso',
    'cea_todos',
    'firmas',
    'lavanderia',
    'cea_directorio',
    'miel_constancias',
    'att_viajes',
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_pins'
  ];
begin
  foreach t in array catalog_tables loop
    execute format(
      'create policy %I on public.%I for select using ( auth.uid() is not null )',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all using ( public.es_admin() ) with check ( public.es_admin() )',
      t || '_admin_write', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Special - documentos and audit_log
-- ============================================================

create policy documentos_read on public.documentos for select
  using ( auth.uid() is not null );

create policy documentos_write on public.documentos for all
  using ( public.auth_rol() in ('admin','asistente') )
  with check ( public.auth_rol() in ('admin','asistente') );

-- audit_log: only admin reads. No INSERT/UPDATE/DELETE policies, so RLS
-- blocks app writes. The audit trigger uses SECURITY DEFINER and bypasses
-- RLS as the function owner (typically postgres).
create policy audit_log_select on public.audit_log for select
  using ( public.es_admin() );
