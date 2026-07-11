# CEA NOCTUA

**Board Assistant** para asistente ejecutiva de junta directiva. Coordina tareas, finanzas de caja chica, consumos de tarjetas corporativas y solicitudes de pago, con auditoría automática de todas las operaciones.

- **Producción:** https://cea.noctuapo.com
- **Stack:** React + TypeScript + Vite + Supabase + Vercel

---

## Quick start

```powershell
# 1. Clonar y instalar
git clone https://github.com/ricardosagastumegon/ceanoctua.git
cd ceanoctua
npm install

# 2. Configurar env (copiar de .env.example)
cp .env.example .env
# Editar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Correr dev server
npm run dev
# Abre http://localhost:5173

# 4. Build de producción
npm run build
```

## Estructura

```
├── CLAUDE.md               # Fuente de verdad operativa (léelo primero)
├── docs/
│   ├── BITACORA.md         # Diario de fases y decisiones históricas
│   └── PROCESO-Y-DECISIONES.md   # ADRs
├── src/
│   ├── components/ui/      # Componentes base reusables
│   ├── lib/                # Utils transversales (supabase, auth, dates, money)
│   ├── modules/            # Un directorio por dominio
│   │   ├── admin/          # Catálogos maestros
│   │   ├── board/          # Vistas por miembro de la junta
│   │   ├── cc-board/       # Caja chica: vales, liquidaciones
│   │   ├── dashboard/      # Home + KPIs
│   │   └── finanzas/       # Consumos TC, Pagos, Reintegros
│   └── types/database.ts   # Types de Supabase
├── supabase/
│   ├── migrations/         # SQL versionado por fase
│   └── scripts/            # Utilidades sueltas (reload-schema, etc.)
├── scripts/                # Node scripts (apply-sql, reset-password)
├── reference/              # Mockups y refs — parcialmente gitignored
└── .claude/skills/         # Skills propios de Claude Code para el proyecto
```

## Comandos frecuentes

| Comando | Descripción |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Build de producción |
| `npx tsc -b` | Type-check estricto |
| `node scripts/apply-sql.mjs <archivo.sql>` | Aplicar migración (requiere PAT) |
| `node scripts/reset-password.mjs` | Reset password de un usuario auth |

## Módulos principales

### Board (miembros de la junta)
Vista dedicada por miembro: MMA · JA · LA · JM · AA · EG · PE. Cada uno con sus tareas, regalos, contactos, y — en el caso de LA — 8 sub-tablas de detalle (autos, residencias, mascotas, staff, etc.).

### CC Board (caja chica)
Flujo de vales → liquidaciones → pagos con seriales server-side (`VL-2026-####`), estados auditados y PDF imprimible.

### Finanzas
- **Vales:** desembolsos a empleados o vales a entidades. Multi-vale por liquidación.
- **Liquidaciones:** agrupan compras (con factura, cantidad, precio) contra uno o más vales.
- **Consumos TC Corporativas:** gallery de tarjetas con color custom, importación de estados de cuenta.
- **Pagos SP:** bandeja de Solicitudes de Pago con timeline horizontal de 6 pasos (Generado → Pagado).
- **Reintegros:** dashboard read-only de vales tipo `entidad` agrupados por empleado.

### Admin
Catálogos maestros: Empleados, Entidades, Proveedores, Personal JD, Tipos de Pago, Tarjetas de Crédito, Status de Solicitud de Pago. Cada uno con importador CSV/Excel.

## Contribuir

Ver `CLAUDE.md` (léelo completo antes de tu primer cambio) y `docs/PROCESO-Y-DECISIONES.md`.

### Reglas duras

1. Toda mutación pasa por Supabase con RLS activo y queda en `audit_log`.
2. Cambios de schema van como migración en `supabase/migrations/`.
3. Cada migración termina con `NOTIFY pgrst, 'reload schema';`.
4. Nunca `git push` sin autorización explícita en la sesión.

Lista completa de invariantes en `CLAUDE.md` §4.

## Licencia

Propietario. Uso interno de la asistencia ejecutiva. No redistribuible.
