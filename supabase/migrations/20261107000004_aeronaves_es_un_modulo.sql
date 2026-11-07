-- Fase 51 · Aeronaves pasa a ser un modulo que se puede conceder
--
-- `usuario_modulos_modulo_chk` enumera los modulos que se le pueden dar a
-- alguien, y `aeronaves` no estaba en la lista. El efecto era silencioso y
-- raro: el modulo existe, tiene sus pantallas y sus politicas, pero NADIE
-- podia tenerlo --el `insert` lo rechazaba-- asi que en la practica era solo
-- de admin, porque `puede()` deja pasar al admin sin mirar la tabla.
--
-- Estaba anotado como deuda desde la fase 45. Deja de ser deuda ahora porque
-- bloquea algo concreto: Javier Arriaza firma las solicitudes de pago del
-- combustible de aeronaves y tiene que poder ver lo que firma.
--
-- Reescribir un CHECK a mano es exactamente donde se cae un modulo sin que
-- nadie lo note hasta que alguien no puede entrar, asi que la comprobacion
-- de abajo los cuenta uno por uno.

alter table public.usuario_modulos
  drop constraint if exists usuario_modulos_modulo_chk;

alter table public.usuario_modulos
  add constraint usuario_modulos_modulo_chk
  check (modulo = any (array[
    'dashboard', 'tt', 'cea', 'finanzas', 'caja_chica', 'miel_sj', 'admin',
    'combustible', 'tesoreria', 'aeronaves',
    -- Las sub-vistas por miembro de junta.
    'maa', 'ja', 'la', 'jm', 'aa', 'eg', 'pe'
  ]));

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  v_def text;
  v_mal text := '';
  m text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.usuario_modulos'::regclass
     and conname = 'usuario_modulos_modulo_chk';

  foreach m in array array[
    'dashboard','tt','cea','finanzas','caja_chica','miel_sj','admin',
    'combustible','tesoreria','aeronaves','maa','ja','la','jm','aa','eg','pe'
  ] loop
    if v_def not like '%''' || m || '''%' then
      v_mal := v_mal || format('el CHECK perdio «%s»; ', m);
    end if;
  end loop;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
