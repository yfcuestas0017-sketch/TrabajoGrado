# Supabase Security Checklist

## Reglas para este login

1. Nunca expongas `service_role` en React.
2. Nunca permitas `select password` desde el frontend.
3. Guarda contrasenas con bcrypt, no en texto plano.
4. Usa funciones seguras o backend para validar credenciales.

## Estado actual del proyecto

- El frontend usa una `publishable key`.
- El login esta preparado para llamar `public.app_login`.
- Falta ejecutar el SQL de `supabase/migrations/20260424_secure_users_login.sql` en tu proyecto.

## Nota de arquitectura

Este login valida credenciales contra `public.users`, pero no crea un JWT de Supabase Auth. Para permisos finos por usuario en consultas futuras, lo ideal a mediano plazo es migrar el acceso a Supabase Auth + RLS por usuario.
