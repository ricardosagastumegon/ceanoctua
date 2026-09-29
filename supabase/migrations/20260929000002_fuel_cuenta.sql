-- Aeronaves · Estado de cuenta del proveedor de combustible
--
-- La cuenta con Aeroclub de Guatemala Gasolinera NO es credito: es un
-- DEPOSITO del que se consume y que se va reponiendo. El down payment ya se
-- hizo; el limite de credito del proveedor es 0.00. Si el deposito se agota,
-- no hay fuel.
--
-- La cuenta es exclusiva de TG-OBI --confirmado con el usuario el
-- 2026-09-29--, o sea que el saldo que calcule CEA si puede cuadrar contra el
-- estado de cuenta del proveedor. Si la cuenta se compartiera con vehiculos u
-- otras aeronaves eso seria imposible y habria que conformarse con conciliar.
--
-- ── El signo ─────────────────────────────────────────────────────────────
-- El Excel del proveedor lleva el saldo en negativo cuando hay dinero a favor
-- --para el somos un pasivo-- y cierra con "Saldo disponible -24,736.20".
-- Aca se invierte: DISPONIBLE EN POSITIVO. El negativo del proveedor es su
-- contabilidad, no la nuestra, y nadie lo lee bien con prisa.
--
-- ── Lo que NO se guarda ──────────────────────────────────────────────────
-- El saldo corriente. Se calcula, igual que la liquidacion del crucero:
--
--   disponible = saldo inicial
--              + abonos historicos  + reposiciones de CEA
--              - cargos historicos  - registros de CEA no anulados
--
-- Guardar `S.Anterior` y `S.Final` como los trae el Excel seria guardar la
-- misma verdad tres veces y darle tres formas de quedar mal.

-- ── 1 · La cuenta ─────────────────────────────────────────────────────────
create table if not exists public.avn_fuel_cuentas (
  id uuid primary key default gen_random_uuid(),
  aeronave_id uuid not null unique references public.avn_aeronaves(id) on delete cascade,

  proveedor text,
  proveedor_nit text,
  moneda text not null default 'GTQ',

  -- El nivel al que se repone el deposito, no un saldo.
  deposito_objetivo numeric(14,2),

  -- Cuando el disponible baja de aqui, la pantalla avisa. No es un numero
  -- arbitrario: son cuatro o cinco dias de abastecimiento, que es lo que
  -- tarda en procesarse un pago. Por debajo de eso hay que iniciar la
  -- reposicion YA o se llega a cero antes de que entre el dinero.
  alerta_minimo numeric(14,2) not null default 8000,

  -- Hasta que fecha manda la historia importada del proveedor. Los registros
  -- de combustible de CEA anteriores a esta fecha NO entran al saldo: ya
  -- estan en la historia y se contarian dos veces.
  historico_hasta date,

  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ── 2 · La historia importada del estado de cuenta ────────────────────────
-- Solo historia. De aqui en adelante los cargos salen de
-- `avn_combustible_registros` y los abonos de `avn_fuel_abonos`.
create table if not exists public.avn_fuel_movimientos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.avn_fuel_cuentas(id) on delete cascade,

  tipo text not null,                    -- 'saldo_inicial' | 'cargo' | 'abono'
  fecha date,
  documento text,                        -- FER / AP / AG / FEBC del proveedor
  comentario text,
  monto numeric(14,2) not null,

  -- El orden del estado de cuenta, que NO es cronologico: el Excel trae la
  -- fila 286 con fecha 21/03/26 y la 287 con 22/02/26. La cadena de saldos
  -- sigue el orden de las filas, asi que es el orden el que manda.
  orden integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_fuel_movimientos_idx
  on public.avn_fuel_movimientos (cuenta_id, orden) where deleted_at is null;

alter table public.avn_fuel_movimientos drop constraint if exists avn_fuel_movimientos_chk;
alter table public.avn_fuel_movimientos add constraint avn_fuel_movimientos_chk
  check (
    tipo in ('saldo_inicial', 'cargo', 'abono')
    -- El monto va siempre positivo y el signo lo pone el tipo. La unica
    -- excepcion es el saldo inicial, que puede arrancar en contra.
    and (tipo = 'saldo_inicial' or monto >= 0)
  );

comment on column public.avn_fuel_movimientos.monto is
  'Siempre positivo; el signo lo pone `tipo`. En saldo_inicial, positivo = a favor.';

-- ── 3 · Las reposiciones hechas desde CEA ─────────────────────────────────
-- El comprobante vive aqui y no en la solicitud de pago porque contabilidad
-- agrupa solicitudes: un solo pago bancario cubre varias SP. Verificado
-- contra el estado de cuenta --67 de 75 abonos son la suma exacta de un grupo
-- de facturas--. Ponerlo en cada SP seria el mismo papel en N lugares.
create table if not exists public.avn_fuel_abonos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.avn_fuel_cuentas(id) on delete cascade,

  fecha date not null,
  monto numeric(14,2) not null default 0,
  moneda text not null default 'GTQ',
  documento text,                        -- el AP/AG/NC que devuelve el proveedor
  comprobante_path text,
  comprobante_nombre text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists avn_fuel_abonos_idx
  on public.avn_fuel_abonos (cuenta_id, fecha) where deleted_at is null;

alter table public.avn_fuel_abonos drop constraint if exists avn_fuel_abonos_chk;
alter table public.avn_fuel_abonos add constraint avn_fuel_abonos_chk
  check (monto >= 0);

-- ── 4 · Que facturas cubre cada reposicion ────────────────────────────────
create table if not exists public.avn_fuel_abono_registros (
  id uuid primary key default gen_random_uuid(),
  abono_id uuid not null references public.avn_fuel_abonos(id) on delete cascade,
  registro_id uuid not null references public.avn_combustible_registros(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists avn_fuel_abono_registros_unq
  on public.avn_fuel_abono_registros (abono_id, registro_id);
create index if not exists avn_fuel_abono_registros_reg_idx
  on public.avn_fuel_abono_registros (registro_id);

-- ── 5 · Triggers comunes ──────────────────────────────────────────────────
drop trigger if exists set_updated_at_avn_fuel_cuentas on public.avn_fuel_cuentas;
create trigger set_updated_at_avn_fuel_cuentas before update on public.avn_fuel_cuentas
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_avn_fuel_movimientos on public.avn_fuel_movimientos;
create trigger set_updated_at_avn_fuel_movimientos before update on public.avn_fuel_movimientos
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_avn_fuel_abonos on public.avn_fuel_abonos;
create trigger set_updated_at_avn_fuel_abonos before update on public.avn_fuel_abonos
  for each row execute function public.set_updated_at();

drop trigger if exists audit_avn_fuel_cuentas on public.avn_fuel_cuentas;
create trigger audit_avn_fuel_cuentas after insert or update or delete
  on public.avn_fuel_cuentas for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_fuel_movimientos on public.avn_fuel_movimientos;
create trigger audit_avn_fuel_movimientos after insert or update or delete
  on public.avn_fuel_movimientos for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_fuel_abonos on public.avn_fuel_abonos;
create trigger audit_avn_fuel_abonos after insert or update or delete
  on public.avn_fuel_abonos for each row execute function public.audit_trigger();
drop trigger if exists audit_avn_fuel_abono_registros on public.avn_fuel_abono_registros;
create trigger audit_avn_fuel_abono_registros after insert or update or delete
  on public.avn_fuel_abono_registros for each row execute function public.audit_trigger();

-- ── 6 · RLS · el mismo modulo que el resto de aeronaves ───────────────────
alter table public.avn_fuel_cuentas enable row level security;
alter table public.avn_fuel_movimientos enable row level security;
alter table public.avn_fuel_abonos enable row level security;
alter table public.avn_fuel_abono_registros enable row level security;

drop policy if exists avn_fuel_cuentas_read on public.avn_fuel_cuentas;
create policy avn_fuel_cuentas_read on public.avn_fuel_cuentas for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_fuel_cuentas_write on public.avn_fuel_cuentas;
create policy avn_fuel_cuentas_write on public.avn_fuel_cuentas for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_fuel_movimientos_read on public.avn_fuel_movimientos;
create policy avn_fuel_movimientos_read on public.avn_fuel_movimientos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_fuel_movimientos_write on public.avn_fuel_movimientos;
create policy avn_fuel_movimientos_write on public.avn_fuel_movimientos for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_fuel_abonos_read on public.avn_fuel_abonos;
create policy avn_fuel_abonos_read on public.avn_fuel_abonos for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_fuel_abonos_write on public.avn_fuel_abonos;
create policy avn_fuel_abonos_write on public.avn_fuel_abonos for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

drop policy if exists avn_fuel_abono_registros_read on public.avn_fuel_abono_registros;
create policy avn_fuel_abono_registros_read on public.avn_fuel_abono_registros for select
  using (public.puede('aeronaves', 'observador'));
drop policy if exists avn_fuel_abono_registros_write on public.avn_fuel_abono_registros;
create policy avn_fuel_abono_registros_write on public.avn_fuel_abono_registros for all
  using (public.puede('aeronaves', 'editor')) with check (public.puede('aeronaves', 'editor'));

NOTIFY pgrst, 'reload schema';
