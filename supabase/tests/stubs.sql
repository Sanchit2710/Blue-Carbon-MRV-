-- Stubs so migrations + smoke tests run on plain Postgres (Supabase provides these itself). Do NOT run on Supabase.
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint);
create table storage.objects (name text, bucket_id text);
alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n, '/') $$;
