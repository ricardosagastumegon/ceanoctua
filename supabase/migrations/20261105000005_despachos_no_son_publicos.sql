-- Fase 45 · Las funciones de cascada no se llaman desde fuera
--
-- Correccion a 20261105000004. Ahi se escribio:
--
--     revoke execute on function public.envio_despacho_pago(public.envios)
--       from public, anon;
--     -- «Las dos de despacho NO se conceden a nadie»
--
-- El comentario decia la intencion; el SQL no la cumplia. `authenticated`
-- tiene su PROPIO grant --Supabase se lo da por omision a todo lo que crea en
-- `public`-- y revocar de PUBLIC y de `anon` no lo toca. Se verifico despues
-- de aplicar: `has_function_privilege('authenticated', ..., 'execute')`
-- seguia dando true.
--
-- POR QUE IMPORTA. Las dos son `security definer`: corren como dueño y se
-- saltan RLS. PostgREST expone las funciones como RPC, y un parametro de tipo
-- compuesto se puede pasar como objeto JSON. O sea: cualquier usuario con
-- sesion --Lissa hoy, Victor mañana-- podia construirse un `envios` de
-- mentira y llamarlas:
--
--   · envio_despacho_comb_solicitud  -> dar por emitido un vale que nadie
--                                       entrego, con el numero que quisiera
--   · envio_despacho_pago            -> avanzar CUALQUIER solicitud de pago a
--                                       «Procesado» sin que el Tesorero la
--                                       hubiera recibido
--
-- Lo segundo es falsificar un paso de autorizacion de pago. Que haga falta
-- una sesion valida lo hace dificil, no aceptable.
--
-- Estas dos funciones solo las llama `envio_aceptar`, que corre como dueño y
-- por tanto no necesita permiso de nadie. Fuera de ahi no hay ningun caso de
-- uso legitimo: la cascada existe porque hubo un envio, y saltarse el envio
-- es precisamente lo que no debe poder hacerse.

revoke execute on function public.envio_despacho_comb_solicitud(public.envios)
  from public, anon, authenticated;
revoke execute on function public.envio_despacho_pago(public.envios)
  from public, anon, authenticated;

-- ── Comprobacion ───────────────────────────────────────────────────────
--
-- Se comprueban los tres roles, no solo `anon`. Ese fue el error original:
-- mirar una via de acceso y dar por cerradas las demas.

do $$
declare
  v_falta text := '';
  f text;
  r text;
begin
  foreach f in array array['envio_despacho_comb_solicitud','envio_despacho_pago'] loop
    foreach r in array array['anon','authenticated'] loop
      if exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = f
           and has_function_privilege(r, p.oid, 'execute')
      ) then
        v_falta := v_falta || format('%s sigue abierta a %s; ', f, r);
      end if;
    end loop;
  end loop;

  -- Y que `envio_aceptar` siga siendo llamable por quien si debe: si esta
  -- correccion la cerrara de mas, la bandeja del Tesorero dejaria de servir.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'envio_aceptar'
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) then
    v_falta := v_falta || 'envio_aceptar quedo cerrada para authenticated; ';
  end if;

  if v_falta <> '' then
    raise exception 'Los permisos no quedaron como se queria: %. No se guarda nada.', v_falta;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
