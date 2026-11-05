-- Fase 44 · Auditoria donde mas falta hacia: la firma, los accesos y el detalle
--
-- La Regla 0 dice que toda mutacion queda en `audit_log` «sin excepciones».
-- En la practica 70 de 104 tablas tenian el trigger, y el patron de las que
-- faltaban era claro: **las cabeceras estaban auditadas y el detalle no**.
-- `caja_chica_liquidaciones` si, sus renglones no. `pagos` si, la firma que
-- lo autoriza no.
--
-- Esta migracion cierra los seis huecos que de verdad importan:
--
--   · firmas            el acto de autorizar no dejaba rastro
--   · firma_miembros    se podia cambiar a quien iba dirigido un documento
--   · usuarios          UN CAMBIO DE ROL A ADMIN NO QUEDABA REGISTRADO
--   · caja_chica_liq_rows   el desglose de una rendicion
--   · liquidacion_vales     que vale entra en que liquidacion
--   · consumo_renglones     el desglose de un consumo
--
-- La mas grave era `usuarios`: un admin pasa todos los controles por
-- definicion, asi que promover a alguien es el cambio de privilegio mas
-- consecuente del sistema, y era el unico que no se registraba. Llamaba mas
-- la atencion porque `usuario_modulos` si estaba auditada: quedaba constancia
-- de quien recibia permiso sobre un modulo, pero no de quien se volvia dueño
-- de todo.

-- ── Variante para tablas de union ──────────────────────────────────────
--
-- `firma_miembros` y `liquidacion_vales` no tienen columna `id` --son pares
-- de llaves foraneas-- y el trigger generico, que hace `NEW.id`, revienta en
-- ellas. Esta variante toma como `registro_id` la llave del padre, que es por
-- donde se busca: «que le paso a la firma FR-2026-0004».

create or replace function public.audit_trigger_union()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
  v_col text := TG_ARGV[0];
begin
  if TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  else
    v_old := to_jsonb(OLD);
    v_new := null;
  end if;

  v_id := (coalesce(v_new, v_old) ->> v_col)::uuid;

  insert into public.audit_log
    (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values
    (TG_TABLE_NAME, v_id, lower(TG_OP), auth.uid(), v_old, v_new);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end $$;

comment on function public.audit_trigger_union() is
  'Auditoria para tablas de union sin columna id. Recibe como argumento la columna que hace de registro_id.';

-- ── Los seis triggers ──────────────────────────────────────────────────

drop trigger if exists audit_firmas on public.firmas;
create trigger audit_firmas
  after insert or update or delete on public.firmas
  for each row execute function public.audit_trigger();

drop trigger if exists audit_usuarios on public.usuarios;
create trigger audit_usuarios
  after insert or update or delete on public.usuarios
  for each row execute function public.audit_trigger();

drop trigger if exists audit_caja_chica_liq_rows on public.caja_chica_liq_rows;
create trigger audit_caja_chica_liq_rows
  after insert or update or delete on public.caja_chica_liq_rows
  for each row execute function public.audit_trigger();

drop trigger if exists audit_consumo_renglones on public.consumo_renglones;
create trigger audit_consumo_renglones
  after insert or update or delete on public.consumo_renglones
  for each row execute function public.audit_trigger();

drop trigger if exists audit_firma_miembros on public.firma_miembros;
create trigger audit_firma_miembros
  after insert or update or delete on public.firma_miembros
  for each row execute function public.audit_trigger_union('firma_id');

drop trigger if exists audit_liquidacion_vales on public.liquidacion_vales;
create trigger audit_liquidacion_vales
  after insert or update or delete on public.liquidacion_vales
  for each row execute function public.audit_trigger_union('liquidacion_id');

-- ── Comprobacion ───────────────────────────────────────────────────────

do $$
declare
  v_falta text;
begin
  select string_agg(t, ', ')
    into v_falta
    from unnest(array[
      'firmas', 'usuarios', 'firma_miembros',
      'caja_chica_liq_rows', 'liquidacion_vales', 'consumo_renglones'
    ]) as t
   where not exists (
     select 1
       from pg_trigger g
       join pg_class c on c.oid = g.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and g.tgname like 'audit%'
        and not g.tgisinternal
   );

  if v_falta is not null then
    raise exception 'Estas tablas quedaron sin auditoria: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
