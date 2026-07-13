# Reporte · Estado actual del módulo T&T en `/arriaza`

**Fecha:** 2026-07-12
**Alcance:** Read-only inventory. No se mutó nada.
**Método:** grep + reads sobre `src/` y `supabase/migrations/`. No tengo `SUPABASE_PAT` en esta sesión, así que **los datos en vivo (row counts + verificación del registro "efqwrqe")** se marcan como pendientes de que el usuario los confirme con una query en Supabase Studio (una al final de cada sección aplicable).

---

## 1. Ruta `/arriaza`

**Ruta registrada en:** [src/app/router.tsx:17,55](src/app/router.tsx)

```tsx
// línea 17
const ArriazaPage = lazy(() => import('@/modules/arriaza/page'));

// línea 55 (dentro del array de children)
{ path: 'arriaza', element: withSuspense(<ArriazaPage />) },
```

**Componente concreto:** [src/modules/arriaza/page.tsx](src/modules/arriaza/page.tsx) (2 líneas — solo re-exporta) → [src/modules/arriaza/AttPage.tsx](src/modules/arriaza/AttPage.tsx) (la página real).

**Sub-módulos que renderiza AttPage:** viajes (raíz) + 3 tabs internos: tickets, hoteles, restaurantes. Layout `src/modules/arriaza/`:

```
ArriazaMap.tsx        # mapa con lat/lng de cada viaje
AttPage.tsx           # container principal (dashboard + tab del viaje abierto)
page.tsx              # re-export a lazy
hoteles/              # api.ts, hooks.ts, HotelForm.tsx, HotelesSection.tsx
restaurantes/         # api.ts, hooks.ts, RestauranteForm.tsx, RestaurantesSection.tsx
shared/               # utilidades cross-módulo
tickets/              # api.ts, hooks.ts, TicketForm.tsx, TicketsSection.tsx
viajes/               # api.ts, hooks.ts, ViajeForm.tsx (SIN Section — la usa AttPage directamente)
```

**¿Usa `createCrudHooks`?** **No.** El módulo tiene **CRUD propio hand-written** por sub-módulo. Prueba: [src/modules/arriaza/viajes/hooks.ts](src/modules/arriaza/viajes/hooks.ts) declara sus hooks manualmente con `useQuery`/`useMutation`, sin importar `createCrudHooks`:

```tsx
// hooks.ts — 42 líneas
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attViajesApi, type AttViajeInsert, type AttViajeUpdate } from './api';

const keys = {
  all: ['att_viajes'] as const,
  detail: (id: string) => ['att_viajes', id] as const,
};

export function useAttViajes() {
  return useQuery({ queryKey: keys.all, queryFn: () => attViajesApi.list() });
}
// ... useAttViaje, useCreateAttViaje, useUpdateAttViaje, useDeleteAttViaje ...
```

Grep de confirmación:
```bash
$ grep -rn "createCrudHooks" src/modules/arriaza/
# (sin resultados)
```

---

## 2. Persistencia: Supabase real, NO localStorage

**Evidencia:** [src/modules/arriaza/viajes/api.ts](src/modules/arriaza/viajes/api.ts) — todas las operaciones son `supabase.from('att_viajes')`, no `localStorage`:

```tsx
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttViaje = Database['public']['Tables']['att_viajes']['Row'];

export const attViajesApi = {
  async list(): Promise<AttViaje[]> {
    const { data, error } = await supabase
      .from('att_viajes')
      .select('*')
      .order('fecha_ini', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  },
  // create/update/remove igualmente contra supabase.from('att_viajes')
};
```

Grep negativo (no hay `localStorage` ni `boardState2` en el módulo arriaza):
```bash
$ grep -rn "localStorage\|boardState2" src/modules/arriaza/
# (sin resultados)
```

**El viaje "efqwrqe" en Planificado vive en:** tabla `public.att_viajes` de Supabase, columna `titulo='efqwrqe'`, `estado='planificado'`. **No** en localStorage. **No lo borré.** Confirmación en vivo pendiente (ver sección 8).

---

## 3. Tabla(s) del módulo

**Nombres reales (todos con prefijo `att_`):**

| Tabla | Función | DDL en migración |
|---|---|---|
| `att_viajes` | raíz del viaje | fase 7 |
| `att_tickets` | vuelos del viaje | fase 7 |
| `att_hoteles` | estadías del viaje | fase 7 |
| `att_restaurantes` | reservas del viaje | fase 7 |
| `att_pins` | pines del mapa (deprecada; ver nota fase 8 abajo) | fase 7 |
| `att_ticket_pax` | pasajeros por ticket (multi) | fase 13 |
| `att_ticket_segments` | tramos por ticket (multi-leg) | fase 13 |
| `att_ticket_pay_records` | pagos por ticket (multi TC/millas) | fase 13 |
| `att_hotel_services` | extras del hotel (transfer, spa) | fase 13 |
| `att_hotel_pay_records` | pagos del hotel | fase 13 |
| `att_restaurant_diners` | comensales por reserva | fase 13 |
| `att_restaurant_services` | extras del restaurante (vinos, propina) | fase 13 |
| `att_restaurant_pay_records` | pagos por reserva | fase 13 |

**13 tablas en total.**

### 3.1 DDL de las 5 tablas raíz — pegado tal cual de [supabase/migrations/20260523000007_arriaza.sql](supabase/migrations/20260523000007_arriaza.sql):

```sql
-- Phase 2 - Migration 0007
-- Arriaza T&T: viajes y sub-tablas + pines del mapa.

create table att_viajes (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  miembro_id    uuid references miembros_board(id),
  titulo        text not null,
  destino       text,
  pais          text,
  ciudad        text,
  fecha_ini     date,
  fecha_fin     date,
  estado        trip_status not null default 'planificado',
  proposito     text,
  acompanantes  text,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index att_viajes_miembro_idx on att_viajes (miembro_id);

create table att_tickets (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  viaje_id        uuid not null references att_viajes(id) on delete cascade,
  aerolinea       text,
  codigo_reserva  text,
  numero_ticket   text,
  origen          text,
  destino         text,
  fecha_salida    timestamptz,
  fecha_llegada   timestamptz,
  asiento         text,
  clase           text,
  monto           numeric(14,2),
  moneda          currency,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index att_tickets_viaje_idx on att_tickets (viaje_id);

create table att_hoteles (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid not null references att_viajes(id) on delete cascade,
  nombre      text not null,
  direccion   text,
  ciudad      text,
  pais        text,
  checkin     date,
  checkout    date,
  confirmacion text,
  monto       numeric(14,2),
  moneda      currency,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_hoteles_viaje_idx on att_hoteles (viaje_id);

create table att_restaurantes (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid not null references att_viajes(id) on delete cascade,
  nombre      text not null,
  ciudad      text,
  direccion   text,
  fecha       date,
  monto       numeric(14,2),
  moneda      currency,
  reserva     text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_restaurantes_viaje_idx on att_restaurantes (viaje_id);

create table att_pins (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid references att_viajes(id) on delete cascade,
  titulo      text,
  categoria   text,
  lat         double precision not null,
  lng         double precision not null,
  direccion   text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_pins_viaje_idx on att_pins (viaje_id);
```

### 3.2 ALTERs de fase 8 — [supabase/migrations/20260528000001_fase8_miel_arriaza.sql:48-93](supabase/migrations/20260528000001_fase8_miel_arriaza.sql):

```sql
-- ARRIAZA T&T - viajes (add reason / paidby / lat / lng)
alter table public.att_viajes add column if not exists other_reason text;
alter table public.att_viajes add column if not exists paidby text;
alter table public.att_viajes add column if not exists lat double precision;
alter table public.att_viajes add column if not exists lng double precision;

-- ARRIAZA T&T - tickets (add tipo de vuelo, número de vuelo, comentarios)
alter table public.att_tickets add column if not exists tipo_vuelo text default 'ida_vuelta';
alter table public.att_tickets add column if not exists numero_vuelo text;
alter table public.att_tickets add column if not exists comentarios text;

-- ARRIAZA T&T - hoteles
alter table public.att_hoteles add column if not exists location text;
alter table public.att_hoteles add column if not exists nights integer;
alter table public.att_hoteles add column if not exists room text;
alter table public.att_hoteles add column if not exists rate numeric(14,2);
alter table public.att_hoteles add column if not exists ota text;
alter table public.att_hoteles add column if not exists pay text;
alter table public.att_hoteles add column if not exists services text;
alter table public.att_hoteles add column if not exists cancel_policy text;

-- ARRIAZA T&T - restaurantes
alter table public.att_restaurantes add column if not exists specialty text;
alter table public.att_restaurantes add column if not exists phone text;
alter table public.att_restaurantes add column if not exists email text;
alter table public.att_restaurantes add column if not exists location text;
alter table public.att_restaurantes add column if not exists hora time;
alter table public.att_restaurantes add column if not exists covers integer;
alter table public.att_restaurantes add column if not exists conf text;
alter table public.att_restaurantes add column if not exists detalles text;
alter table public.att_restaurantes add column if not exists cancel_policy text;
alter table public.att_restaurantes add column if not exists stars integer;

-- att_pins: redundant — map markers derive from att_viajes (lat/lng).
-- Keep the table for now (it has RLS/triggers) but no code uses it.
-- A future cleanup migration can drop it.
```

### 3.3 DDL de las 8 sub-tablas — [supabase/migrations/20260530000003_fase13_arriaza_details.sql:18-154](supabase/migrations/20260530000003_fase13_arriaza_details.sql):

```sql
-- Tickets · pax
create table if not exists public.att_ticket_pax (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  tipo            text,                -- 'AD' | 'CHD' | 'INF' | 'SSA'
  nombre          text,                -- nombre completo en pasaporte
  nacionalidad    text,
  pasaporte_num   text,
  pasaporte_exp   date,
  libreta_num     text,
  visa_pais       text,
  visa_num        text,
  visa_exp        date,
  ffn             text,
  programa        text,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tickets · segments (multi-leg)
create table if not exists public.att_ticket_segments (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  direccion       text,                -- 'dep' | 'ret'
  origen_iata     text,
  origen_ciudad   text,
  destino_iata    text,
  destino_ciudad  text,
  fecha           date,
  checkin         time,
  etd             time,
  eta             time,
  numero_vuelo    text,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tickets · pay records
create table if not exists public.att_ticket_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  metodo          text,                -- 'tc' | 'millas' | 'millasd' | 'puntos' | 'efectivo'
  tc_id           text,                -- '**** 1234'
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Hotels · services
create table if not exists public.att_hotel_services (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  hotel_id        uuid not null references public.att_hoteles(id) on delete cascade,
  nombre          text not null,
  monto           numeric(14,2) not null default 0,
  notas           text,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Hotels · pay records
create table if not exists public.att_hotel_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  hotel_id        uuid not null references public.att_hoteles(id) on delete cascade,
  tc_id           text,
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Restaurants · diners
create table if not exists public.att_restaurant_diners (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  nombre          text not null,
  notas           text,
  orden           int,
  created_at      timestamptz not null default now()
);

-- Restaurants · services
create table if not exists public.att_restaurant_services (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  nombre          text not null,
  monto           numeric(14,2) not null default 0,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Restaurants · pay records
create table if not exists public.att_restaurant_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  tc_id           text,
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 3.4 Enum `trip_status` — [supabase/migrations/20260523000001_extensions_enums_helpers.sql:19](supabase/migrations/20260523000001_extensions_enums_helpers.sql):

```sql
create type trip_status as enum ('planificado','en_curso','completado','cancelado');
```

Este es el enum que usa `att_viajes.estado`. Los 4 valores exactos son los que el viaje "efqwrqe" puede tomar.

### 3.5 Notas sobre el schema

- **Sin `deleted_at`** en ninguna de las 13 tablas → no hay soft delete. Un DELETE es físico. Contradice CLAUDE.md §4 invariante 6, pero es lo que hay hoy.
- **Sin serial de negocio** (`TT-YYYY-####`, `VJ-YYYY-####` u otro). Solo `id uuid`.
- `att_pins` está deprecada según comentario de fase 8 ("no code uses it") pero la tabla sigue existiendo con RLS y triggers.
- Columna `services_total numeric(14,2)` en `att_hoteles` fue agregada en fase 13 con trigger `trg_recalc_hotel_services` que recalcula al insertar/actualizar/borrar en `att_hotel_services`.

---

## 4. ¿Están en `src/types/database.ts`?

**Sí, todas.** Bloques encontrados con `grep -n "att_" src/types/database.ts`:

| Línea | Bloque |
|---|---|
| 697 | `att_viajes: { Row / Insert / Update / Relationships }` |
| 755 | `att_tickets` |
| 819 | `att_hoteles` |
| 893 | `att_restaurantes` |
| ~980 | `att_ticket_pax` |
| ~1010 | `att_ticket_segments` |
| ~1035 | `att_ticket_pay_records` |
| (y sus pares hotel/restaurant) | ... |

**Bloque `att_viajes` completo pegado tal cual** (líneas 697-754):

```typescript
att_viajes: {
  Row: AuditCols & {
    id: string;
    legacy_id: number | null;
    miembro_id: string | null;
    titulo: string;
    destino: string | null;
    pais: string | null;
    ciudad: string | null;
    fecha_ini: string | null;
    fecha_fin: string | null;
    estado: Database['public']['Enums']['trip_status'];
    proposito: string | null;
    other_reason: string | null;
    paidby: string | null;
    acompanantes: string | null;
    notas: string | null;
    lat: number | null;
    lng: number | null;
  };
  Insert: AuditInsert & {
    id?: string;
    legacy_id?: number | null;
    miembro_id?: string | null;
    titulo: string;
    destino?: string | null;
    pais?: string | null;
    ciudad?: string | null;
    fecha_ini?: string | null;
    fecha_fin?: string | null;
    estado?: Database['public']['Enums']['trip_status'];
    proposito?: string | null;
    other_reason?: string | null;
    paidby?: string | null;
    acompanantes?: string | null;
    notas?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  Update: AuditUpdate & {
    miembro_id?: string | null;
    titulo?: string;
    destino?: string | null;
    pais?: string | null;
    ciudad?: string | null;
    fecha_ini?: string | null;
    fecha_fin?: string | null;
    estado?: Database['public']['Enums']['trip_status'];
    proposito?: string | null;
    other_reason?: string | null;
    paidby?: string | null;
    acompanantes?: string | null;
    notas?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  Relationships: [];
};
```

**Nota:** `att_viajes` usa el sistema `AuditCols/AuditInsert/AuditUpdate` (created_at, updated_at, created_by, updated_by, deleted_at?). Las sub-tablas `att_tickets` / `att_hoteles` / `att_restaurantes` **NO** usan `AuditCols` — sólo tienen `created_at` y `updated_at` explícitos. Es una inconsistencia dentro del propio módulo.

---

## 5. RLS

**Todas las tablas tienen RLS habilitada y política del Pattern C (con la variante fase 8 que permite escribir al asistente).**

### 5.1 Las 5 tablas raíz — evolución

**Fase 3 · migración `20260524000003_rls_policies.sql:115-155`** — inicialmente Pattern C estricto (write solo admin):

```sql
-- Pattern C - catalog tables (read all authenticated, write admin)
do $$
declare
  t text;
  catalog_tables text[] := array[
    'miembros_board','empleados','entidades','autorizadores','tipos_pago',
    'proveedores','tarjetas_credito','kit_items','evento_religioso',
    'cea_todos','firmas','lavanderia','cea_directorio','miel_constancias',
    'att_viajes', 'att_tickets', 'att_hoteles', 'att_restaurantes', 'att_pins'
  ];
begin
  foreach t in array catalog_tables loop
    execute format(
      'create policy %I on public.%I for select using ( auth.uid() is not null )',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all using ( public.es_admin() ) with check ( public.es_admin() )',
      t || '_admin_write', t
    );
  end loop;
end;
```

**Fase 8 · migración `20260528000001_fase8_miel_arriaza.sql:101-115`** — se abre a `admin + asistente`:

```sql
-- att_* también deben ser escribibles por asistente, ya que CEA maneja
-- Miel y Arriaza día a día. Ajustar policies.
do $$
declare
  t text;
  tables text[] := array['miel_constancias','att_viajes','att_tickets','att_hoteles','att_restaurantes'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all
        using ( public.auth_rol() in (''admin'',''asistente'') )
        with check ( public.auth_rol() in (''admin'',''asistente'') )',
      t || '_write', t
    );
  end loop;
end; $$;
```

**Nota:** `att_pins` quedó atrás en la lista de la actualización de fase 8 — sigue con la política `_admin_write` original (solo admin escribe). Si nadie escribe a `att_pins` (deprecada), es indiferente.

**Patrón identificado:** Pattern C · Catálogo (variante financial-lite: read auth + write admin/asistente). NO es Pattern A estricto (`auth_rol() in ('admin','asistente')` en select + all), pero es equivalente en la práctica.

### 5.2 Las 8 sub-tablas (fase 13)

Pattern C completo con write `admin/asistente` desde el arranque — [supabase/migrations/20260530000003_fase13_arriaza_details.sql:159-188](supabase/migrations/20260530000003_fase13_arriaza_details.sql):

```sql
-- RLS — Pattern C (read all authenticated, write admin|asistente)
do $$
declare
  t text;
  detail_tables text[] := array[
    'att_ticket_pax','att_ticket_segments','att_ticket_pay_records',
    'att_hotel_services','att_hotel_pay_records',
    'att_restaurant_diners','att_restaurant_services','att_restaurant_pay_records'
  ];
begin
  foreach t in array detail_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() is not null)',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all
         using (public.auth_rol() in (''admin'',''asistente''))
         with check (public.auth_rol() in (''admin'',''asistente''))',
      t || '_write', t
    );
  end loop;
end $$;
```

---

## 6. `audit_trigger`

**Ninguna de las 13 tablas `att_*` tiene `audit_trigger`.**

Evidencia:

```bash
$ grep -n "audit_.*att_\|create trigger audit.*att" supabase/migrations/*.sql
# (sin resultados)
```

Contrastar con [supabase/migrations/20260524000004_audit_triggers.sql:46-53](supabase/migrations/20260524000004_audit_triggers.sql) — el array `finance_tables` que sí recibió el trigger:

```sql
finance_tables text[] := array[
  'tc_consumos',
  'reintegros',
  'caja_chica_vales',
  'caja_chica_liquidaciones',
  'pagos',
  'vouchers'
];
```

Las 13 tablas `att_*` **no están en esa lista** y ninguna migración posterior las agregó. Consistente con lo que decía CLAUDE.md antes de fase 18: los catálogos y las tablas de módulos "operativos no financieros" no tienen audit_trigger.

Esta es exactamente la deuda técnica documentada en ADR **D-016** ([docs/PROCESO-Y-DECISIONES.md:D-016](docs/PROCESO-Y-DECISIONES.md)). Si en la fase 19 el rebuild toca `att_viajes` o crea tablas nuevas relacionadas, la Regla 0 exige agregar el audit_trigger.

---

## 7. Migraciones que las crearon

**4 migraciones relevantes al módulo T&T actual:**

| # | Archivo | Aporte |
|---|---|---|
| 1 | [supabase/migrations/20260523000001_extensions_enums_helpers.sql](supabase/migrations/20260523000001_extensions_enums_helpers.sql:19) | Enum `trip_status` |
| 2 | [supabase/migrations/20260523000007_arriaza.sql](supabase/migrations/20260523000007_arriaza.sql) | Crea las 5 tablas raíz `att_viajes`, `att_tickets`, `att_hoteles`, `att_restaurantes`, `att_pins` + índices |
| 3 | [supabase/migrations/20260524000003_rls_policies.sql](supabase/migrations/20260524000003_rls_policies.sql:115-155) | Habilita RLS + política Pattern C admin-write inicial en las 5 raíz |
| 4 | [supabase/migrations/20260528000001_fase8_miel_arriaza.sql](supabase/migrations/20260528000001_fase8_miel_arriaza.sql:48-115) | ALTERs para `other_reason`, `paidby`, `lat`, `lng`, `tipo_vuelo`, `numero_vuelo`, `location`, `nights`, `room`, `rate`, `ota`, `pay`, `services`, `cancel_policy`, `specialty`, `phone`, `email`, `hora`, `covers`, `conf`, `detalles`, `stars` + abre RLS a asistente |
| 5 | [supabase/migrations/20260530000003_fase13_arriaza_details.sql](supabase/migrations/20260530000003_fase13_arriaza_details.sql) | Crea las 8 sub-tablas (pax/segments/pay_records/services/diners) + RLS Pattern C admin+asistente + trigger `trg_recalc_hotel_services` |

**Migraciones NO tocan T&T:**
- Ninguna fase 14, 15, 16, 17, 18 modifica tablas `att_*`.
- Ninguna migración las dropea, renombra o renombra columnas.

---

## 8. Datos

**No puedo consultar la base de datos en vivo** desde esta sesión (no tengo `SUPABASE_PAT` ni ejecuté `apply-sql.mjs`). Todo lo siguiente es **inferencia + query pendiente que el usuario debe correr**:

### 8.1 Inferencia sobre "efqwrqe"

El nombre "efqwrqe" (secuencia de teclas típica de prueba: `e-f-q-w-r-q-e`) sugiere fuertemente **un registro de prueba escrito manualmente por el usuario mientras validaba el form de "Crear Viaje" en `/arriaza`**. No es un dato operativo. Vive como una fila en `public.att_viajes` con `titulo='efqwrqe'` y `estado='planificado'`. **No lo borré ni lo modifiqué.**

### 8.2 Query pendiente que el usuario debe correr en Supabase Studio

Copiar-pegar todo el bloque en `https://supabase.com/dashboard/project/bbxieuyhzxqygkkxwvwo/sql/new`:

```sql
-- Row counts de las 13 tablas
select 'att_viajes' as tabla, count(*) as filas from public.att_viajes
union all select 'att_tickets', count(*) from public.att_tickets
union all select 'att_hoteles', count(*) from public.att_hoteles
union all select 'att_restaurantes', count(*) from public.att_restaurantes
union all select 'att_pins', count(*) from public.att_pins
union all select 'att_ticket_pax', count(*) from public.att_ticket_pax
union all select 'att_ticket_segments', count(*) from public.att_ticket_segments
union all select 'att_ticket_pay_records', count(*) from public.att_ticket_pay_records
union all select 'att_hotel_services', count(*) from public.att_hotel_services
union all select 'att_hotel_pay_records', count(*) from public.att_hotel_pay_records
union all select 'att_restaurant_diners', count(*) from public.att_restaurant_diners
union all select 'att_restaurant_services', count(*) from public.att_restaurant_services
union all select 'att_restaurant_pay_records', count(*) from public.att_restaurant_pay_records;

-- Detalle del viaje "efqwrqe"
select id, titulo, destino, pais, ciudad, fecha_ini, fecha_fin, estado,
       created_at, created_by
  from public.att_viajes
 where titulo = 'efqwrqe';
```

**Reporte esperado:** probablemente **1 fila** en `att_viajes` (la de "efqwrqe") y **0** en el resto. El usuario debe confirmar y decidir si "efqwrqe" es basura de prueba (borrable) o dato a preservar.

---

## 9. Dependencias para el rebuild fase 19

### 9.1 Tabla `personas` (fase 15) — sí existe

**Migración:** [supabase/migrations/20260530000005_fase15_personas.sql:24-38](supabase/migrations/20260530000005_fase15_personas.sql). Está aplicada según BITACORA (fase 15, 2026-06-04). DDL pegado tal cual:

```sql
create table if not exists public.personas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  iniciales       text unique,
  nit             text,
  dir             text,
  es_jd           boolean not null default false,
  es_autorizador  boolean not null default false,
  es_firmante     boolean not null default false,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists personas_es_autorizador_idx on public.personas(es_autorizador) where es_autorizador;
create index if not exists personas_es_jd_idx on public.personas(es_jd) where es_jd;
```

**Columnas clave para F19:** `id`, `nombre`, `iniciales`, `es_jd` (para el select "Participantes" del viaje si se quiere enlazar en vez de texto libre).

RLS: Pattern C admin+asistente (misma migración, líneas 53-59).

### 9.2 Tabla `tarjetas_credito` (fase 3) — sí existe · nombre exacto

**Migración:** [supabase/migrations/20260523000002_identity.sql:99-118](supabase/migrations/20260523000002_identity.sql). DDL pegado:

```sql
create table tarjetas_credito (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  tipo        tc_tipo not null,                    -- 'corporativa' | 'presidencia'
  tc_id       text not null,                       -- terminacion / identificador
  empresa     text,
  titular     text,
  red         text,                                -- VISA / Mastercard / Amex
  banco       text,
  nit         text,
  limite      text,
  direccion   text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index tarjetas_credito_tipo_idx on tarjetas_credito (tipo);
```

**Para el "Pagado con" de F19:**
- Tabla: `public.tarjetas_credito` (nombre exacto, sin prefijo `tt_` ni sufijo).
- Filtro para presi: `where tipo = 'presidencia'` (enum `tc_tipo` con literales `'corporativa'`/`'presidencia'`).
- Etiqueta a mostrar: `red || ' **** ' || tc_id || ' — ' || coalesce(titular, empresa)` (o similar; el catálogo ya existe en Admin → Tarjetas con color picker desde fase 17).

### 9.3 DocumentAttachment + bucket `documentos` — sí existe

**Componente React:** [src/components/ui/DocumentAttachment.tsx](src/components/ui/DocumentAttachment.tsx) — 148 líneas, ya soporta upload/list/delete contra Supabase Storage.

```tsx
// líneas 1-24
type DocRow = {
  id: string;
  nombre: string;
  storage_path: string;
  tipo_mime: string | null;
  tamano_bytes: number | null;
  created_at: string;
};

type DocumentAttachmentProps = {
  entidadTipo: string;         // e.g. 'eventos', o para F19 sería 'viaje_ticket', 'viaje_hotel', ...
  entidadId: string | null;
  canEdit?: boolean;
  label?: string;
  accept?: string;
  bucket?: string;
};

const DEFAULT_BUCKET = 'documentos';
```

**Tabla `documentos`** (fase 2 · [supabase/migrations/20260523000008_documentos_audit.sql:4-16](supabase/migrations/20260523000008_documentos_audit.sql)):

```sql
create table documentos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  nombre        text not null,
  tipo_mime     text,
  tamano_bytes  bigint,
  storage_path  text not null,                     -- ruta en el bucket 'documentos'
  entidad_tipo  text,                              -- nombre de la tabla
  entidad_id    uuid,                              -- id del registro
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index documentos_entidad_idx on documentos (entidad_tipo, entidad_id);
```

**Bucket `documentos`** en Supabase Storage — verificado por uso desde 2 módulos: `board/eventos/EventoForm.tsx:114` (`<DocumentAttachment entidadTipo="eventos" ...>`) y `cc-board/liquidaciones/api.ts:130` (`supabase.storage.from('documentos').upload(...)`). Su existencia en Storage se asume por el hecho de que la app funciona en producción (crear liquidaciones con comprobante ya está en uso).

**Ejemplo de uso en producción** — [src/modules/board/eventos/EventoForm.tsx:114](src/modules/board/eventos/EventoForm.tsx):

```tsx
<DocumentAttachment entidadTipo="eventos" entidadId={initial.id} canEdit={true} label="Documento adjunto" />
```

Para F19 el patrón sería `entidadTipo="viaje_ticket"` (o el nombre de tabla que se elija), `entidadId={ticket.id}`.

---

## Resumen ejecutivo (30 segundos)

- **Ruta `/arriaza`:** renderiza `AttPage` desde `src/modules/arriaza/AttPage.tsx`. CRUD hand-written, NO usa `createCrudHooks`.
- **Persistencia:** 100% Supabase. **No hay localStorage.** El viaje "efqwrqe" vive en `public.att_viajes`.
- **13 tablas** ya existen (`att_viajes` + 4 sub raíz + 8 detail). RLS Pattern C admin+asistente, activa. **Sin audit_trigger** (deuda D-016). **Sin soft delete.** **Sin serial de negocio.**
- **Types:** los 13 bloques ya están en `src/types/database.ts`. `att_viajes` usa `AuditCols`; las demás no (inconsistencia).
- **Fase 19:** no parte de cero. Ya existe una base T&T operativa que solo cubre 3 servicios (tickets, hoteles, restaurantes) + viaje raíz + intento de pines. **Pero** la fase 19 propuesta en `PLAN-TT-TOUR-Y-TRAVEL.md` es un modelo NUEVO con nomenclatura `viajes` / `viaje_*` (sin prefijo `att_`) + 14 servicios + itinerario por días + soft delete + serial. **La decisión de arquitectura que falta:** ¿fase 19 EXTIENDE lo que ya hay (rename `att_*` → `viaje_*` + agregar los 11 servicios faltantes) o REEMPLAZA (deprecar `att_*` y crear todo desde cero)? La respuesta a esta pregunta cambia sustancialmente el plan aprobado.
- **Dependencias del rebuild:** `personas` ✅, `tarjetas_credito` ✅ (con `tipo='presidencia'`), `DocumentAttachment` + bucket `documentos` ✅ — todas listas para reuso.

---

**Este reporte no cambió nada en el proyecto.** `git status` debe mostrar únicamente `docs/REPORTE-ESTADO-TT-ACTUAL.md` como archivo nuevo.
