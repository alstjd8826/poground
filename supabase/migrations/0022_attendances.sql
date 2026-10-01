-- ─────────────────────────────────────────── 직관 기록
--
-- 내가 다녀온 포항 경기를 스스로 표시하고 사진 한 장을 남긴다. 본인만 본다.
-- 승·무·패와 승률은 저장하지 않는다 — 경기 결과가 정정되거나 예정 경기가 끝나면 앱이
-- 경기 목록에서 다시 계산한다.
--
-- matches 와 외래키로 묶지 않는다. 경기 표를 정리할 때(0021 처럼) CASCADE 로 기록까지
-- 사라지면 안 된다.
--
-- 다시 돌려도 깨지지 않게 쓴다.

create table if not exists public.attendances (
  owner      uuid not null references auth.users on delete cascade,
  year       int  not null,
  league_id  int  not null,
  game_id    int  not null,
  /** my-attendance-photos 버킷 안 경로. 사진이 없으면 null */
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner, year, league_id, game_id)
);

alter table public.attendances enable row level security;

drop policy if exists "own select" on public.attendances;
create policy "own select" on public.attendances
  for select to authenticated using (auth.uid() = owner);

drop policy if exists "own insert" on public.attendances;
create policy "own insert" on public.attendances
  for insert to authenticated with check (auth.uid() = owner);

drop policy if exists "own update" on public.attendances;
create policy "own update" on public.attendances
  for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists "own delete" on public.attendances;
create policy "own delete" on public.attendances
  for delete to authenticated using (auth.uid() = owner);

drop trigger if exists attendances_touch_updated_at on public.attendances;
create trigger attendances_touch_updated_at
  before update on public.attendances
  for each row execute function public.touch_updated_at();

-- ── 사진 ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('my-attendance-photos', 'my-attendance-photos', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "my-attendance-photos self read" on storage.objects;
create policy "my-attendance-photos self read" on storage.objects
  for select to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self insert" on storage.objects;
create policy "my-attendance-photos self insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self update" on storage.objects;
create policy "my-attendance-photos self update" on storage.objects
  for update to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "my-attendance-photos self delete" on storage.objects;
create policy "my-attendance-photos self delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'my-attendance-photos' and (storage.foldername(name))[1] = auth.uid()::text);
