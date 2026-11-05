-- Fase 45 · Un cuadro de combustible puede ser de Personal JD
--
-- La usuaria lo encontro al llenar el catalogo: «en donde dice RESPONSABLE
-- solo tengo a empleados, debe de alimentarse tambien de PERSONAL JD porque
-- los primeros 3 son de JD».
--
-- Tiene razon y el error fue de origen: `comb_responsables` solo apuntaba a
-- `empleados`. Se comprobo contra los datos reales --de las 10 personas de
-- Personal JD, SEIS no estan en empleados, y entre ellas estan dos de los tres
-- primeros cuadros de su hoja:
--
--   Lissa Arriaza    (Gerente Administrativo)  -> solo en personas
--   Javier Arriaza   (Gerente Agricola)        -> solo en personas
--   Erick Gonzalez   (Gerente General)         -> en las dos
--
-- O sea: dos de los seis cuadros eran imposibles de crear.
--
-- POR QUE NO SE RESUELVE METIENDOLOS EN `empleados`
--
-- Seria lo rapido y seria un error. `personas` es Personal JD --quien
-- autoriza y firma-- y `empleados` es la planilla. Que Lissa aparezca en las
-- dos las desincroniza, y duplicar catalogos es justo el problema que la
-- invariante 4 existe para evitar. Un gerente de junta no es un empleado de
-- planilla aunque las dos listas tengan nombres.
--
-- Asi que el cuadro apunta a una O a la otra, con la misma restriccion que ya
-- usa `viajero_afiliaciones` para persona/invitado.

alter table public.comb_responsables
  add column if not exists persona_id uuid references public.personas(id);

comment on column public.comb_responsables.persona_id is
  'Personal JD. Alternativa a empleado_id: los gerentes de junta no estan en la planilla.';

-- Un cuadro apunta a UNA persona como mucho, y tiene que tener algo que
-- imprimir en su encabezado: la persona, o una etiqueta para los cuadros que
-- no son de nadie en concreto (OTROS, DEPARTAMENTO DE COMPRAS).
alter table public.comb_responsables
  drop constraint if exists comb_responsables_titulo_chk;
alter table public.comb_responsables
  add constraint comb_responsables_titulo_chk
  check (
    num_nonnulls(empleado_id, persona_id) <= 1
    and (
      empleado_id is not null
      or persona_id is not null
      or nullif(trim(etiqueta), '') is not null
    )
  );

-- ── Comprobacion ───────────────────────────────────────────────────────
--
-- Solo estructura. Las pruebas que insertan van en el ensayo en seco, no
-- aqui: un `raise exception` al final de la migracion revertiria tambien el
-- ALTER TABLE, que es lo que vino a hacer.

do $$
declare v_falta text := '';
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'comb_responsables'
       and column_name = 'persona_id'
  ) then
    v_falta := v_falta || 'falta la columna persona_id; ';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.comb_responsables'::regclass
       and conname = 'comb_responsables_titulo_chk'
       and pg_get_constraintdef(oid) like '%persona_id%'
  ) then
    v_falta := v_falta || 'el CHECK no contempla persona_id; ';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.comb_responsables'::regclass
       and contype = 'f'
       and pg_get_constraintdef(oid) like '%personas(id)%'
  ) then
    v_falta := v_falta || 'persona_id no apunta a personas; ';
  end if;

  if v_falta <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
