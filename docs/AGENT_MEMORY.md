# AGENT MEMORY - MVC_CESMAG

Ultima actualizacion: 2026-04-24

## Contexto rapido

- Proyecto frontend: React + Vite (`grado-hub`).
- Objetivo actual: login conectado a Supabase usando tabla `users` con `email` + `password`.
- Seguridad acordada: no exponer `service_role`, no leer `password` desde React, validar credenciales en SQL (RPC).

## Estado actual implementado

- Variables de entorno de Supabase cargadas en `.env.local`.
- Cliente Supabase base:
  - `src/lib/supabase/config.js`
  - `src/lib/supabase/client.js`
- Flujo de auth en frontend actualizado para login por RPC:
  - `src/context/AuthContext.jsx`
  - `src/lib/supabase/usersAuth.js`
- UI de login ajustada para reflejar flujo seguro:
  - `src/pages/Login.jsx`
- Migracion SQL creada para login seguro:
  - `supabase/migrations/20260424_secure_users_login.sql`
- Documentacion de setup y seguridad:
  - `docs/SUPABASE_SETUP.md`
  - `docs/SUPABASE_SECURITY.md`

## Bloqueo actual

Al ejecutar el SQL en Supabase salio:

`ERROR: 42P01: relation "public.users" does not exist`

Interpretacion:
- La tabla `users` no existe en schema `public`, o existe en otro schema.

## Siguiente paso inmediato (DB)

Ejecutar en Supabase SQL Editor:

```sql
select table_schema, table_name
from information_schema.tables
where lower(table_name) = 'users';
```

### Si devuelve `public.users`

- Reintentar la migracion `supabase/migrations/20260424_secure_users_login.sql`.

### Si devuelve otro schema (ejemplo `app.users`)

- Ajustar la migracion para usar ese schema:
  - `alter table <schema>.users ...`
  - `revoke ... on table <schema>.users ...`
  - en la funcion: `declare v_user <schema>.users%rowtype;`
  - query: `from <schema>.users as u`

### Si no devuelve filas

- Crear la tabla primero (o confirmar nombre real de tabla).

## Nota de seguridad importante

- El SQL actual exige password con hash bcrypt (`$2a/$2b/$2y`).
- Si hay passwords en texto plano, primero migrarlas a hash antes de login productivo.

## Comandos de validacion usados

- Build frontend: `npm run build` (ok).
- Prueba RPC desde cliente: devolvio `PGRST202` cuando `app_login` no existia.

## Prompt recomendado para Copilot Agent

Usa este contexto y continua sin rehacer lo ya implementado:

1. Valida en Supabase donde existe la tabla `users`.
2. Ajusta `supabase/migrations/20260424_secure_users_login.sql` al schema correcto.
3. Ejecuta el SQL y verifica que `app_login` exista.
4. Prueba login real desde `src/pages/Login.jsx` con credenciales validas.
5. Mantiene regla de seguridad: frontend nunca consulta `password`.
