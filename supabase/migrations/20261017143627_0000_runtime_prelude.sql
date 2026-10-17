-- ---------- extensions ----------
create extension if not exists pgcrypto;

-- ---------- private helper schema ----------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to postgres, service_role;
