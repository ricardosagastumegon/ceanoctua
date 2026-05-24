-- Phase 5 - Schema adjustments to align catalogos with PLAN-FASE-5.md form fields.
-- proveedores: add razon, celcontacto ; rename telefono->tel, rubro->giro
-- autorizadores: add nit, dir
-- tipos_pago: rename nombre->tipo
-- empleados: rename departamento->depto
-- Idempotent via DO blocks.

-- proveedores ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='proveedores' and column_name='razon') then
    alter table public.proveedores add column razon text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='proveedores' and column_name='celcontacto') then
    alter table public.proveedores add column celcontacto text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='proveedores' and column_name='telefono') then
    alter table public.proveedores rename column telefono to tel;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='proveedores' and column_name='rubro') then
    alter table public.proveedores rename column rubro to giro;
  end if;
end;
$$;

-- autorizadores ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autorizadores' and column_name='nit') then
    alter table public.autorizadores add column nit text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='autorizadores' and column_name='dir') then
    alter table public.autorizadores add column dir text;
  end if;
end;
$$;

-- tipos_pago -------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='tipos_pago' and column_name='nombre')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='tipos_pago' and column_name='tipo') then
    alter table public.tipos_pago rename column nombre to tipo;
  end if;
end;
$$;

-- empleados --------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='empleados' and column_name='departamento')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='empleados' and column_name='depto') then
    alter table public.empleados rename column departamento to depto;
  end if;
end;
$$;
