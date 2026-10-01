-- supabase/tests 의 검증 스크립트를 로컬에서 돌릴 때 쓰는 Supabase 흉내.
-- 역할(anon/authenticated), auth.uid(), storage.objects, 기본 권한, 0011~0017 까지의 댓글·관리자 상태.
-- 실제 DB 가 아니다. 정책이 서로 어떻게 맞물리는지 보려는 것이고, 마지막 확인은 SQL Editor 에서 한다.

-- Supabase 흉내: 역할, auth, storage, 기본 권한, 0011~0017 의 댓글·관리자 상태
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated;
create table auth.users (id uuid primary key, aud text, role text, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant select, insert, update, delete on storage.objects to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create table public.admins (user_id uuid primary key references auth.users on delete cascade, note text not null default '',
  granted_by uuid, created_at timestamptz not null default now(), role text not null default 'moderator', handle_at_grant text);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid()) $$;
create function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create table public.comments (id uuid primary key default gen_random_uuid(), author uuid not null references auth.users on delete cascade,
  parent_id uuid references public.comments on delete cascade, body text not null, subject_type text not null default 'match',
  subject_id text not null, deleted_at timestamptz, deleted_by_admin boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.comments add constraint comments_subject_known check (subject_type in ('match', 'player', 'news'));
alter table public.comments enable row level security;
create policy "read all" on public.comments for select to anon, authenticated using (true);
create policy "own insert" on public.comments for insert to authenticated with check (auth.uid() = author);
create policy "own or admin update" on public.comments for update to authenticated
  using (auth.uid() = author or public.is_admin()) with check (auth.uid() = author or public.is_admin());
grant all on public.comments, public.admins to anon, authenticated;
grant select on auth.users to anon, authenticated;

-- ── 0011·0017 의 댓글 신고 (신고함 검증에 필요)
create table public.comment_reports (
  comment_id uuid not null references public.comments on delete cascade,
  reporter   uuid not null references auth.users on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users on delete set null,
  primary key (comment_id, reporter)
);
alter table public.comment_reports enable row level security;
create policy "own insert" on public.comment_reports
  for insert to authenticated with check (auth.uid() = reporter);
create policy "own or admin select" on public.comment_reports
  for select to authenticated using (auth.uid() = reporter or public.is_admin());

-- ── pg_net·Vault 흉내. 트리거가 부르는 모양만 맞춘다. http_post 는 부른 것을 적어 둔다
create schema if not exists net;
create table net.calls (url text, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int)
returns bigint language plpgsql security definer as $$
begin
  insert into net.calls values (url, body);
  return 1;
end $$;
grant usage on schema net to anon, authenticated;
create schema if not exists vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values ('functions_url', 'http://fn'), ('cron_secret', 's');

-- ── 0006·0007 의 프로필 (운영자 이름 잠금 검증에 필요)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,
  handle text not null unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "public read" on public.profiles for select to anon, authenticated using (true);
create policy "self update" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
