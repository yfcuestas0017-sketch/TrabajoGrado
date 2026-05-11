# Supabase Setup

Este proyecto ahora espera validar el login contra `public.users` por medio de una funcion segura en Supabase.

## Paso obligatorio

Antes de probar el login real, ejecuta este archivo en el SQL Editor de Supabase:

- `supabase/migrations/20260424_secure_users_login.sql`

## Que hace ese SQL

1. Activa `pgcrypto`.
2. Habilita RLS en `public.users`.
3. Revoca acceso directo del cliente a la tabla que contiene contrasenas.
4. Crea la funcion `public.app_login(p_email, p_password)`.

## Variables necesarias

En `.env.local` solo deben vivir estas variables de frontend:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxx
```

## Importante

La app nunca debe consultar la columna `password` desde React. La validacion se hace dentro de Supabase y el frontend solo recibe el usuario validado.
