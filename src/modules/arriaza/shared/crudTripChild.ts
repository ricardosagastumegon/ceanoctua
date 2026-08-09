// Deliberadamente vacío. Se intentó un helper genérico makeTripChildApi() para
// reducir boilerplate en los 11 servicios nuevos de F19-2, pero el union de tablas
// hacía imposible tipar .eq()/.select() sin recurrir a `any` (violación de
// CLAUDE.md §6.1). Cada servicio implementa su propio api.ts con CRUD directo
// contra Supabase, siguiendo el pattern de viajes/api.ts (fase 7).
export {};
