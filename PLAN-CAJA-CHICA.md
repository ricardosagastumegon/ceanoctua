# Fase 20 · Caja Chica Operativa

## Objetivo
Módulo NUEVO `/caja-chica` en CEA para operar la caja chica del día a día:
períodos con monto inicial, líneas de gasto con carga de facturas, y vales
como forma de pago que después se liquidan con sub-facturas (el vuelto
vuelve al saldo del período).

**NO** reemplaza al módulo `Control Vales` (`/finanzas#vales`) — ese pertenece
a otra persona con su flujo formal de firmas y aprobaciones. Este módulo es
para la operación diaria y en el futuro migrará a una BD dedicada para la
persona que lo opere.

## Modelo (schema)

### `caja_chica_op_periodos`
- `id uuid pk`
- `serial text unique` — `CCO-YYYY-####` (trigger + sequence por año)
- `titulo text`
- `fecha date not null default current_date`
- `monto_inicial numeric(12,2) not null check (monto_inicial >= 0)`
- `estado text default 'Abierto' check (estado in ('Abierto','Cerrado'))`
- `notas text`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

### `caja_chica_op_lineas`
- `id uuid pk`
- `periodo_id uuid fk → periodos(id) on delete cascade`
- `fecha date`
- `factura text` (No. factura)
- `nombre text` (nombre/producto/concepto)
- `cantidad numeric(12,2)` (unidades)
- `p_unitario numeric(12,2)` (precio unitario)
- `solicitante text`
- `lugar text`
- `forma_pago text check (forma_pago in ('Efectivo','Caja chica','Transferencia','Cheque','Tarjeta','Vale','Otro'))`
- `observaciones text`
- `foto_url text` (Supabase Storage, opcional)
- `vale_estado text default 'Abierto' check (vale_estado in ('Abierto','Liquidado'))` — solo aplica si `forma_pago='Vale'`
- `orden int` (para reordenar)
- `created_at`, `updated_at`, `deleted_at`

### `caja_chica_op_vale_facturas`
- `id uuid pk`
- `linea_id uuid fk → lineas(id) on delete cascade`
- `fecha date`
- `factura text`
- `nombre text`
- `cantidad numeric(12,2)`
- `p_unitario numeric(12,2)`
- `foto_url text`
- `created_at`, `updated_at`, `deleted_at`

## Reglas de negocio
- **Total línea** = `cantidad × p_unitario`
- **Total sub-factura** = `cantidad × p_unitario`
- **Consumo real de línea**:
  - Si `forma_pago ≠ 'Vale'` → consumo = total línea
  - Si `forma_pago = 'Vale' AND vale_estado='Abierto'` → consumo = total línea (bloqueado como anticipo potencial)
  - Si `forma_pago = 'Vale' AND vale_estado='Liquidado'` → consumo = suma de sub_facturas
- **Vuelto de un vale** = `total_línea − suma(sub_facturas)` — informativo (positivo = vuelve a caja; negativo = faltante)
- **Saldo del período** = `monto_inicial − suma(consumo_real)`

## RLS
Pattern A (Financial): admin + asistente pueden leer y escribir. Todas las
tablas con RLS habilitado y política definida.

## Audit
`audit_log_trigger` en las 3 tablas.

## UI (React)
- `/caja-chica` (ruta nueva, entrada en `TabsNav` visible para admin+asistente)
- Lista de períodos + botón `+ Nuevo período`
- Click en período → detalle con:
  - Header: serial, título, fecha, monto inicial, gastado, saldo
  - Tabla de líneas: 14 columnas (# · Fecha · Factura · Nombre · Cantidad · P. Unit · Total · Solicitante · Lugar · Forma pago · Obs · Saldo · Foto · Acciones)
  - Modo edit/lock por línea (como en el HTML standalone)
  - Fila roja + botón Liquidar cuando `forma_pago='Vale' AND vale_estado='Abierto'`
- Modal Liquidar Vale: sub-facturas editables + vuelto calculado en vivo + botón "Marcar liquidado"

## Diferido a fases siguientes
- Foto upload a Supabase Storage (v0.1 acepta URL manual)
- Print/PDF del período
- Export Excel
- Import CSV
