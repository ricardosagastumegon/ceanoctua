-- Fase 52 · La aeronave que de verdad se abastecio
--
-- LO QUE FALTABA, en sus palabras: «NO te pedi un espacio para seleccionar la
-- matricula, se deduce que siempre es TG OBI, pero a veces se tiene que usar
-- otra aeronave para suplir al TG OBI, a la cual se le abastece combustible
-- de la cuenta del TG OBI».
--
-- El registro cuelga de `aeronave_id` porque cuelga de la CUENTA --el deposito
-- con el Aeroclub es de la TG-OBI y de ahi sale el combustible. Eso no
-- cambia: si cambiara, el estado de cuenta dejaria de cuadrar.
--
-- Lo que falta es otra cosa: QUE AVION LLENO ESE VALE. Normalmente la misma,
-- y por eso nadie lo echaba de menos; cuando no, la matricula esta en el vale
-- de papel --la del ejemplo dice N224PK, que no es la TG-OBI-- y hasta ahora
-- no tenia donde guardarse. Es un dato del hecho, no de la cuenta, asi que va
-- en el registro y no toca nada del saldo.
--
-- Texto libre a proposito: el avion que suple puede ser prestado, alquilado o
-- de un tercero, y no tiene por que estar en `avn_aeronaves`. Exigir que
-- estuviera obligaria a dar de alta una aeronave ajena solo para anotar un
-- vale, que es como los catalogos se llenan de cosas que nadie mantiene.

alter table public.avn_combustible_registros
  add column if not exists matricula_abastecida text;

comment on column public.avn_combustible_registros.matricula_abastecida is
  'La matricula que figura en el vale, cuando no es la de la cuenta. Nula = se abastecio la aeronave de la cuenta. Texto libre: el avion que suple puede no ser de la casa.';

-- ══════════════════════════════════════════════════════════════════════
-- Comprobacion
-- ══════════════════════════════════════════════════════════════════════

do $$
declare v_mal text := '';
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='avn_combustible_registros'
       and column_name='matricula_abastecida'
  ) then
    v_mal := v_mal || 'falta matricula_abastecida; ';
  end if;

  -- `aeronave_id` sigue siendo obligatorio: es de donde sale el combustible,
  -- y es lo que ata el registro a su estado de cuenta.
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='avn_combustible_registros'
       and column_name='aeronave_id' and is_nullable = 'YES'
  ) then
    v_mal := v_mal || 'aeronave_id quedo opcional, y es la cuenta de la que sale; ';
  end if;

  if v_mal <> '' then
    raise exception 'La migracion no quedo completa: %. No se guarda nada.', v_mal;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
