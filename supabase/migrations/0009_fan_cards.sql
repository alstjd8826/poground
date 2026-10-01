-- ─────────────────────────────────────────── 내가 만든 카드
--
-- 기기에만 두던 것을 서버로 옮긴다. 앱을 지우면 카드도 사라지던 문제가 사라지고,
-- 기기를 바꿔도 따라온다.
--
-- id 를 uuid 로 둔다. 예전에는 만든 시각(Date.now())을 썼는데, 두 기기에서 같은
-- 밀리초에 만들면 겹치고 로그인 뒤 서버에 모을 때 서로를 덮어쓴다.
--
-- 주인만 본다. 커뮤니티에서 남의 카드를 보여줄 일이 생기면 그때 공개 정책을
-- 따로 더한다 — 지금 열어 두면 남의 얼굴 사진이 딸려 나간다.

create table public.fan_cards (
  id         uuid primary key,
  owner      uuid not null references auth.users on delete cascade,
  name       text not null default '',
  back_no    text not null default '',
  tagline    text not null default '',
  tint       text not null,
  pattern    text not null,
  effect     text not null,
  /** fan-cards 버킷의 공개 주소. 사진 없이 만든 카드는 비어 있다 */
  photo_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 보관함은 최근에 만든 것을 앞에 놓는다
create index fan_cards_owner_idx on public.fan_cards (owner, created_at desc);

alter table public.fan_cards enable row level security;

create policy "own select" on public.fan_cards
  for select to authenticated using (auth.uid() = owner);

create policy "own insert" on public.fan_cards
  for insert to authenticated with check (auth.uid() = owner);

create policy "own update" on public.fan_cards
  for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

create policy "own delete" on public.fan_cards
  for delete to authenticated using (auth.uid() = owner);

create trigger fan_cards_touch_updated_at
  before update on public.fan_cards
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────── 사진 저장소
--
-- 공개 버킷이다. 프로필 이미지(0008)와 같은 이유로, 나중에 카드를 남에게 보여주거나
-- 공유할 때 서명 URL 을 매번 발급하는 것보다 주소를 그대로 쓰는 쪽이 낫다.
-- 경로에 uuid 가 들어가 추측으로는 닿지 못하고, 올리고 지우는 것은 본인 폴더만이다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fan-cards',
  'fan-cards',
  true,
  5 * 1024 * 1024,                                  -- 카드 사진은 아바타보다 크게 쓴다
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fan-cards public read" on storage.objects;
create policy "fan-cards public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'fan-cards');

drop policy if exists "fan-cards self insert" on storage.objects;
create policy "fan-cards self insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fan-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fan-cards self update" on storage.objects;
create policy "fan-cards self update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fan-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fan-cards self delete" on storage.objects;
create policy "fan-cards self delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fan-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
