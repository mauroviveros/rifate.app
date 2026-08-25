# Propuesta de esquema — PostgreSQL

> ## ⚠️ NO APLICAR
>
> Estos ocho archivos son **PostgreSQL** y se escribieron cuando la base iba a
> ser Supabase. Con la decisión de usar **D1 (SQLite)** no son ejecutables:
>
> | Se usa acá | En SQLite |
> |---|---|
> | `create type ... as enum` | No existe → `TEXT` + `CHECK` |
> | `numeric(12,2)` | No existe → `INTEGER` de centavos |
> | `gen_random_uuid()` | No existe → generar en el Worker |
> | `generate_series()` | No existe → generar el rango en TS |
> | `create policy` (RLS) | **No existe** → autorización en TypeScript |
> | Funciones plpgsql | No existen → lógica en el Worker |
> | `security definer` | No aplica |
>
> **Valen como especificación, no como código.** Las tablas, columnas,
> relaciones, constraints de coherencia y reglas de permiso son el diseño a
> portar. Ver [../03-modelo-de-datos.md](../03-modelo-de-datos.md) y
> [../04-rls-y-roles.md](../04-rls-y-roles.md).

## Archivos

| Archivo | Contenido |
|---|---|
| `...120000_init_enums_helpers.sql` | Enums y helpers de autorización |
| `...120100_profiles.sql` | Perfiles + trigger de alta |
| `...120200_raffles.sql` | Rifas, slug, constraints por tier |
| `...120300_buyers_numbers.sql` | Compradores y grilla materializada |
| `...120400_orders.sql` | Pedidos con reserva (PRO) |
| `...120500_vouchers.sql` | Vouchers y canjes |
| `...120600_rpc.sql` | **Las 9 funciones que pasan a TypeScript** |
| `...120700_rls.sql` | **Las políticas que pasan a la capa de autorización** |
