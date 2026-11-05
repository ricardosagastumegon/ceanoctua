-- Fase 45 · Que «marcar pagada» se note en la bandeja del Tesorero
--
-- `pago_marcar_pagado` movia el pago y la cascada, pero no dejaba nada en el
-- envio. Y ahi esta el problema: el Tesorero NO PUEDE LEER `pagos`. Para el,
-- una SP que acepto y una SP que ya pago se veian exactamente igual --no
-- tenia forma de distinguirlas, porque lo unico que ve es `envios`.
--
-- Se arregla donde corresponde: la funcion sella el envio al pagarlo. Es
-- `security definer`, asi que puede escribir lo que el usuario no.
--
-- Se guarda en `datos` y no en una columna nueva a proposito: `datos` es el
-- lugar previsto para lo que aporta el destinatario, y cada tipo de documento
-- aporta lo suyo --el vale su numero, el pago su fecha de pago. Una columna
-- `pagado_at` en `envios` solo tendria sentido para uno de los cinco tipos.

create or replace function public.pago_marcar_pagado(p_pago uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_orig   text[];
  v_fechas text[];
  v_rep    uuid;
begin
  if auth.uid() is null then
    raise exception 'Hay que haber iniciado sesion.';
  end if;

  -- Solo lo marca quien lo recibio, o el admin.
  if not public.es_admin() and not exists (
    select 1 from public.envios
     where doc_tipo = 'pago' and doc_id = p_pago
       and destinatario_id = auth.uid()
       and estado = 'aceptado' and deleted_at is null
  ) then
    raise exception 'Esta solicitud de pago no esta a su cargo.';
  end if;

  select coalesce(step_dates, '{}'::text[]) into v_orig
    from public.pagos where id = p_pago and deleted_at is null;

  if not found then
    raise exception 'La solicitud de pago ya no existe.';
  end if;

  select array_agg(v_orig[i] order by i) into v_fechas
    from generate_series(1, 6) as i;

  v_fechas[6] := to_char(now(), 'YYYY-MM-DD');

  update public.pagos
     set step_idx   = 5,
         step_dates = v_fechas,
         status     = 'Pagado',
         updated_by = auth.uid()
   where id = p_pago and step_idx < 5;

  -- EL SELLO EN EL ENVIO. Sin esto el Tesorero no puede distinguir en su
  -- bandeja lo que ya pago de lo que solo acepto.
  update public.envios
     set datos = coalesce(datos, '{}'::jsonb)
                 || jsonb_build_object('pagado_at', to_char(now(), 'YYYY-MM-DD')),
         updated_by = auth.uid()
   where doc_tipo = 'pago' and doc_id = p_pago
     and estado = 'aceptado' and deleted_at is null;

  select id into v_rep
    from public.comb_reportes
   where pago_id = p_pago and deleted_at is null;

  if v_rep is not null then
    update public.comb_reportes
       set estado = 'pagado', updated_by = auth.uid()
     where id = v_rep;

    update public.comb_solicitudes
       set estado = 'pagada', updated_by = auth.uid()
     where reporte_id = v_rep and deleted_at is null
       and estado in ('en_reporte','en_tesoreria');
  end if;
end $$;

revoke execute on function public.pago_marcar_pagado(uuid) from public, anon;
grant  execute on function public.pago_marcar_pagado(uuid) to authenticated;

-- ── Comprobacion ───────────────────────────────────────────────────────

do $$
declare v_falta text := '';
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'pago_marcar_pagado'
       and has_function_privilege('anon', p.oid, 'execute')
  ) then
    v_falta := v_falta || 'anon puede ejecutar pago_marcar_pagado; ';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'pago_marcar_pagado'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) then
    v_falta := v_falta || 'authenticated no puede ejecutarla; ';
  end if;

  -- Que el sello al envio este de verdad en el cuerpo de la funcion.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'pago_marcar_pagado'
       and p.prosrc like '%pagado_at%'
  ) then
    v_falta := v_falta || 'la funcion no sella el envio; ';
  end if;

  if v_falta <> '' then
    raise exception 'No quedo como se queria: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
