-- ─────────────────────────────────────────── 프로필
--
-- 로그인한 사람의 앱 안 이름. 카카오가 준 닉네임과 따로 둔다.
--
-- 왜 auth.users 의 user_metadata 로 안 하나:
--   user_metadata 는 본인만 읽는다. 커뮤니티가 붙으면 글쓴이 닉네임을 **남이** 봐야
--   하므로 그때 통째로 옮겨야 한다. 처음부터 테이블로 둔다.
--
-- 왜 가입 트리거로 자동 생성하지 않나:
--   행이 없는 상태가 "아직 닉네임을 안 정했다" 는 신호다. 자동으로 만들어 두면
--   첫 로그인에서 닉네임을 받을 타이밍을 앱이 알 수 없다.

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nickname   text not null,
  /** 카카오 프로필 사진. 동의를 안 받았으면 비어 있다 */
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 공백만 넣거나 지나치게 긴 이름을 막는다. 화면에서도 막지만 여기가 마지막 방어선이다
alter table public.profiles
  add constraint profiles_nickname_len
  check (char_length(btrim(nickname)) between 1 and 20);

alter table public.profiles enable row level security;

-- 닉네임은 누구나 읽는다. 로그인 없이도 커뮤니티 글의 글쓴이를 보여줄 수 있어야 한다
create policy "public read" on public.profiles
  for select to anon, authenticated using (true);

-- 만들고 고치는 것은 본인 것만. using 과 with check 를 둘 다 걸어야
-- "남의 행을 내 것으로 바꿔치기" 가 막힌다
create policy "self insert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "self update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "self delete" on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- updated_at 을 앱이 챙기게 두면 빠뜨린다
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
