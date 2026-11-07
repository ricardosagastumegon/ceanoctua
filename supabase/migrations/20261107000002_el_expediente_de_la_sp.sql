-- Fase 49 · El expediente de la Solicitud de Pago
--
-- LO PEDIDO: «cuando esté la SP deberá de tener también opción de cargar un
-- PDF con todo esto [...] facturas, vales, órdenes de despacho, contraseñas y
-- control de vales». El papel oficial no los lista uno a uno --dice «se
-- adjuntan»-- asi que el respaldo tiene que estar en alguna parte.
--
-- Y LA REGLA DE QUIEN LO VE, en sus palabras: «quien tenga acceso a las SP
-- tanto al momento de hacerlas, procesarlas como yo, autorizarlas y firmarlas
-- como Lissa, recibirlas y confirmarlas como Victor deberán poder ver ese
-- documento adjunto, porque eso es el respaldo de la SP». Y a la vez: «yo no
-- puedo ver nada de ella a menos que me lo comparta».
--
-- Las dos frases juntas dicen una sola cosa, y no es la que parece: EL
-- ADJUNTO NO CUELGA DE UN ROL, CUELGA DE LA SOLICITUD. «Lo ve quien ve la
-- SP» es lo unico que sigue siendo cierto cuando entre Zonia con sus propias
-- solicitudes. Si en vez de eso se escribiera «lo ven admin, asistente,
-- solo_lectura y tesoreria», el dia que haya dos espacios habria que
-- reescribirlo --y lo normal es que se reescriba uno de los dos sitios y no
-- el otro.
--
-- Por eso hay UNA funcion, `puede_ver_pago`, y tanto la tabla `documentos`
-- como el bucket la obedecen. Es `security invoker` a proposito: por dentro
-- consulta `pagos` y `envios` con las politicas del que pregunta, asi que no
-- repite quien puede ver una SP --lo averigua preguntandolo. El dia que
-- `pagos_select` lleve el dueño para separar a Zonia, los adjuntos la siguen
-- sin tocarlos.
--
-- DE PASO SE CIERRA UN AGUJERO. El bucket `documentos` tenia lectura
-- `auth.uid() IS NOT NULL`: cualquier sesion leia cualquier archivo. Cuando
-- se escribio esa politica el unico usuario era la dueña; ahora estan Lissa y
-- Victor, y lo que se va a empezar a subir ahi son facturas y contraseñas. El
-- bucket esta vacio, asi que no hay nada expuesto, pero acotarlo tiene que ir
-- en LA MISMA migracion que habilita la subida y no en la siguiente.

-- ══════════════════════════════════════════════════════════════════════
-- 1 · Quien puede ver una solicitud de pago
-- ══════════════════════════════════════════════════════════════════════
--
-- `security invoker` --el valor por omision, aqui escrito a proposito-- es lo
-- que hace que esto no sea una copia de las reglas sino una pregunta sobre
-- ellas:
--
--   · el `select` sobre `pagos` pasa por `pagos_select`, que hoy deja a
--     admin, asistente y solo_lectura. Asi ven la SP Angeles y Lissa.
--   · el `select` sobre `envios` pasa por `envios_read`, que deja ver a cada
--     quien lo suyo. Asi la ve Victor, que NO lee `pagos`: la SP le llega
--     dentro del envio.

create or replace function public.puede_ver_pago(p_pago uuid)
returns boolean
language sql
stable
security invoker
set search_path to 'public'
as $$
  select exists (
      select 1 from public.pagos p
       where p.id = p_pago and p.deleted_at is null
    )
    or exists (
      select 1 from public.envios e
       where e.doc_tipo = 'pago'
         and e.doc_id = p_pago
         and e.destinatario_id = auth.uid()
         and e.deleted_at is null
    );
$$;

comment on function public.puede_ver_pago(uuid) is
  'Si la sesion puede ver esa solicitud de pago: porque lee `pagos`, o porque se la enviaron. Security INVOKER a proposito: pregunta por las politicas en vez de repetirlas.';

revoke execute on function public.puede_ver_pago(uuid) from public, anon;
grant  execute on function public.puede_ver_pago(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 2 · La tabla `documentos`
-- ══════════════════════════════════════════════════════════════════════
--
-- Generica (`entidad_tipo` + `entidad_id` + `storage_path`) y hasta hoy sin
-- una sola fila. La lectura era `auth.uid() IS NOT NULL`, igual que el
-- bucket.
--
-- Se acota por entidad. Hoy solo se usa para `pago`; lo que no se reconozca
-- se queda en quien opera, que es lo prudente mientras no haya una regla
-- escrita para ello --y obliga a escribirla al añadir el siguiente tipo, en
-- vez de heredar un permiso de mas sin darse cuenta.

alter table public.documentos enable row level security;

-- El mismo criterio para los otros dos puntos de adjunto que ya existian en
-- el codigo --`firmas` y `vouchers`, los dos sin una sola fila todavia--: se
-- ve el adjunto si se ve aquello de lo que cuelga. Se preguntan tal cual,
-- porque un `select` dentro de una politica tambien pasa por las politicas de
-- la tabla que consulta. Dejarlos en «admin y asistente» les habria quitado a
-- Lissa los documentos de sus propias firmas sin que nadie lo notara, porque
-- hoy no hay ninguno que echar en falta.

drop policy if exists documentos_read on public.documentos;
create policy documentos_read on public.documentos for select
  using (
    case entidad_tipo
      when 'pago' then public.puede_ver_pago(entidad_id)
      when 'firmas' then exists (
        select 1 from public.firmas f where f.id = entidad_id)
      when 'vouchers' then exists (
        select 1 from public.vouchers v where v.id = entidad_id)
      else public.auth_rol() in ('admin','asistente')
    end
  );

-- Subir y quitar es de quien opera la SP. Victor la ve, no la arma: lo que el
-- aporta --el numero del vale, la confirmacion-- viaja por `envios`.
drop policy if exists documentos_write on public.documentos;
create policy documentos_write on public.documentos for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- Borrar un adjunto es FISICO --la tabla no tiene `deleted_at`-- y hasta
-- ahora no quedaba ni rastro. En lo que va a respaldar solicitudes de pago
-- firmadas eso no se sostiene: el expediente de una SP que alguien quito
-- tiene que poder reconstruirse al menos en el registro. El trigger de
-- auditoria guarda el `before` completo, con nombre y ruta.
drop trigger if exists audit_documentos on public.documentos;
create trigger audit_documentos
  after insert or update or delete on public.documentos
  for each row execute function public.audit_trigger();

-- ══════════════════════════════════════════════════════════════════════
-- 3 · El bucket
-- ══════════════════════════════════════════════════════════════════════
--
-- La misma regla, enforcada otra vez. El `exists` sobre `public.documentos`
-- vuelve a pasar por la politica de arriba, asi que no hay una segunda copia
-- del criterio: hay una sola, consultada dos veces.
--
-- Efecto secundario sano: un archivo en el bucket sin fila en `documentos`
-- no lo lee nadie. Un huerfano deja de ser una fuga y pasa a ser basura.

drop policy if exists "documentos read authenticated" on storage.objects;
drop policy if exists "documentos read" on storage.objects;
create policy "documentos read" on storage.objects for select
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.documentos d where d.storage_path = storage.objects.name
    )
  );

-- Al subir todavia no existe la fila --se crea despues, con el `storage_path`
-- que devuelve la subida-- asi que aqui no se puede preguntar por ella. Se
-- queda en quien opera, que es quien puede crear esa fila de todas formas.
drop policy if exists "documentos insert" on storage.objects;
create policy "documentos insert" on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

drop policy if exists "documentos update" on storage.objects;
create policy "documentos update" on storage.objects for update
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  )
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

-- Borrar el archivo sin poder borrar su fila dejaria la lista enseñando un
-- adjunto que ya no se puede abrir, asi que va con el mismo rol.
drop policy if exists "documentos delete" on storage.objects;
create policy "documentos delete" on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

-- ══════════════════════════════════════════════════════════════════════
-- 4 · Comprobacion
-- ══════════════════════════════════════════════════════════════════════
--
-- Aqui solo se comprueba la ESTRUCTURA. La prueba de que cada quien ve lo
-- suyo --que es la que de verdad importa-- necesita insertar dos SP y dos
-- adjuntos, y eso no puede quedarse en la base: va en la prueba en seco, que
-- corre esto mismo dentro de una transaccion que se revierte.

do $$
declare
  v_mal text := '';
  pol   text;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'puede_ver_pago'
  ) then
    v_mal := v_mal || 'falta puede_ver_pago; ';
  end if;

  if has_function_privilege('anon', 'public.puede_ver_pago(uuid)', 'execute') then
    v_mal := v_mal || 'anon puede ejecutar puede_ver_pago; ';
  end if;

  if not exists (
    select 1 from pg_class k join pg_namespace n on n.oid = k.relnamespace
     where n.nspname = 'public' and k.relname = 'documentos' and k.relrowsecurity
  ) then
    v_mal := v_mal || 'documentos sin RLS; ';
  end if;

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.documentos'::regclass
       and tgname = 'audit_documentos' and not tgisinternal
  ) then
    v_mal := v_mal || 'documentos sin auditoria; ';
  end if;

  -- La lectura de la tabla tiene que apoyarse en la funcion, no en un
  -- `auth.uid() is not null`, que es lo que habia.
  select qual into pol from pg_policies
   where schemaname = 'public' and tablename = 'documentos' and policyname = 'documentos_read';
  if pol is null or pol not like '%puede_ver_pago%' then
    v_mal := v_mal || 'documentos_read no pasa por puede_ver_pago; ';
  end if;

  -- Y el bucket tampoco puede quedar abierto a cualquier sesion.
  foreach pol in array array['documentos read','documentos insert','documentos update','documentos delete'] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'storage' and tablename = 'objects' and policyname = pol
    ) then
      v_mal := v_mal || format('falta la politica «%s» del bucket; ', pol);
    end if;
  end loop;

  -- Se busca `storage_path`, que solo aparece en el enlace con la tabla:
  -- Postgres guarda la expresion ya resuelta y quita el esquema, asi que
  -- buscar «public.documentos» no encontraria nada aunque este bien.
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'documentos read'
       and qual not like '%storage_path%'
  ) then
    v_mal := v_mal || 'la lectura del bucket no se apoya en la tabla documentos; ';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'documentos read authenticated'
  ) then
    v_mal := v_mal || 'sigue viva la politica vieja del bucket; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
