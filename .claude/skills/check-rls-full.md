---
name: check-rls-full
description: Auditoría completa de RLS en todas las tablas de public. Detecta tablas con policies pero RLS deshabilitado (condición del incidente 2026-08-09 · ADR D-021), tablas sin policies, y tablas nuevas sin RLS enabled. Correr semanalmente o cada vez que se aplica una migración compleja.
---

# check-rls-full

Skill de auditoría de seguridad para RLS. Nace del incidente del 2026-08-09 donde 34 tablas quedaron con RLS deshabilitado sin causa clara (ver ADR D-021).

## Cuándo usarlo

- **Semanal** — check de rutina para detectar drift silencioso.
- **Post-migración compleja** — si una migración fase F1+ usa bloques `do $$ ... end $$` con `alter table … enable row level security`, verificar después que sí quedaron habilitadas.
- **Ante warning de Supabase Advisor** — cuando el Advisor reporta "Policy Exists RLS Disabled" en Security.

## Cómo usarlo

1. **Correr el script SQL de diagnóstico** [`supabase/scripts/check-rls-full.sql`](../../supabase/scripts/check-rls-full.sql) en Supabase Studio SQL Editor.
2. **Analizar los 3 reportes**:
   - **Reporte A** · Tablas con RLS OFF (críticas · exposición al anon key)
   - **Reporte B** · Tablas con RLS ON pero sin policies (usualmente OK · deniega todo por default)
   - **Reporte C** · Tablas sin RLS enabled + sin policies (nuevas · pueden ser intencionalmente públicas)
3. **Para el Reporte A**, si hay filas → generar migración de fix idempotente:
   ```sql
   BEGIN;
   do $$
   declare
     t text;
     affected text[] := array['tabla1', 'tabla2', ...];
   begin
     foreach t in array affected loop
       execute format('alter table public.%I enable row level security', t);
     end loop;
   end $$;
   COMMIT;
   NOTIFY pgrst, 'reload schema';
   ```
4. **Aplicar y verificar** con la Query A de nuevo.

## Reglas de interpretación

| Estado observado | Acción |
|---|---|
| Reporte A vacío | ✅ Todo OK, no hacer nada |
| Reporte A con filas | 🔴 CRÍTICO — generar y aplicar migración de re-enable ya |
| Reporte B con `usuarios` u otras tablas core sin policies | 🟠 Revisar — probablemente falta la policy read/write |
| Reporte B con tablas de audit_log tipo append-only | ✅ OK — RLS true + no policies deniega todo, esperado |
| Reporte C con tablas nuevas de una fase reciente | 🟠 Verificar si son intencionalmente públicas o si falta habilitar RLS |

## Formato de output esperado

Al terminar, escribir al usuario:

```
🔒 check-rls-full · YYYY-MM-DD

Reporte A (RLS off con policies · CRÍTICO):
  - X tablas afectadas · ver lista arriba
  [O] ✅ 0 tablas afectadas

Reporte B (RLS on sin policies · revisar):
  - N tablas · lista

Reporte C (RLS off sin policies · tablas públicas):
  - N tablas · lista

Acción recomendada:
  [Si A>0] Generar migración fix + aplicar en Supabase Studio.
  [Si A=0] Sin acción necesaria hasta próximo check.
```
