-- CC Board · quien paga la liquidacion deja de ser texto libre
--
-- EL PROBLEMA
--
-- «Entidad o personal que paga» era un campo de texto. Con 17 liquidaciones
-- ya habia siete grafias distintas y dos que no correspondian a nada:
-- «TIC TAC TOE S.A.» contra un catalogo que dice «TIC TAC TOE», y una
-- liquidacion que decia «MIGUEL ANGEL ARRIAZA» cuando su vale venia de
-- AGROATLANTIC. Sin amarre no hay trazabilidad, y sin trazabilidad no se
-- puede sostener la regla que viene despues: juntar varias liquidaciones en
-- una sola solicitud de pago solo si las paga el mismo.
--
-- EL MODELO
--
-- El pagador es una entidad del catalogo O una persona de Personal JD, nunca
-- las dos y nunca texto inventado. Las dos existen ya: las cuatro personas
-- que aparecian escritas --Javier, Alejandro, Patricia, Miguel Angel-- estan
-- todas en `personas`, asi que no hay que inventar entidades falsas para
-- acomodarlas.
--
-- `entidad` (texto) se queda como la foto de lo que se escribio ese dia. Es
-- el mismo criterio que `pagado_con` en T&T: un reporte reimpreso tiene que
-- decir lo que decia cuando se emitio.

alter table public.caja_chica_liquidaciones
  add column if not exists paga_entidad_id uuid references public.entidades(id),
  add column if not exists paga_persona_id uuid references public.personas(id);

comment on column public.caja_chica_liquidaciones.paga_entidad_id is
  'Entidad que paga, del catalogo de Admin. Excluyente con paga_persona_id.';
comment on column public.caja_chica_liquidaciones.paga_persona_id is
  'Persona de Personal JD que paga, cuando no es una entidad.';

alter table public.caja_chica_liquidaciones
  drop constraint if exists caja_chica_liquidaciones_paga_chk;
alter table public.caja_chica_liquidaciones
  add constraint caja_chica_liquidaciones_paga_chk
  check (paga_entidad_id is null or paga_persona_id is null);

-- ── Amarre de lo ya capturado ────────────────────────────────────────────
-- 1) Nombre exacto del catalogo de entidades.
update public.caja_chica_liquidaciones l
   set paga_entidad_id = e.id
  from public.entidades e
 where upper(trim(l.entidad)) = upper(trim(e.nombre))
   and l.paga_entidad_id is null
   and l.paga_persona_id is null;

-- 2) La misma empresa escrita distinto. Lo confirma su vale, que viene de
--    TIC TAC TOE. Decision del usuario el 2026-11-03: solo esta se corrige;
--    la que dice MIGUEL ANGEL ARRIAZA se queda como persona.
update public.caja_chica_liquidaciones l
   set paga_entidad_id = (select id from public.entidades where nombre = 'TIC TAC TOE')
 where upper(trim(l.entidad)) = 'TIC TAC TOE S.A.'
   and l.paga_entidad_id is null
   and l.paga_persona_id is null;

-- 3) Lo que queda y coincide con Personal JD.
update public.caja_chica_liquidaciones l
   set paga_persona_id = p.id
  from public.personas p
 where upper(trim(l.entidad)) = upper(trim(p.nombre))
   and l.paga_entidad_id is null
   and l.paga_persona_id is null;

NOTIFY pgrst, 'reload schema';
