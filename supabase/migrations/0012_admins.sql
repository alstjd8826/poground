-- ─────────────────────────────────────────── 관리자 명단
--
-- 0011 은 관리자를 profiles.is_admin 이라는 **칸 하나**로 뒀다. 그걸 여기서 따로 모은
-- 표로 옮긴다. 0011 의 public.is_admin() 도 여기서 덮어쓰므로, 0011 을 다시 돌릴 일이
-- 있으면 이 파일도 이어서 돌려야 한다.
--
-- 왜 표로 옮기나:
--   · 누가 관리자인지 한자리에서 본다. 칸으로 두면 사람 전체를 훑어야 안다
--   · 언제·누가·왜 줬는지가 남는다. 남의 글을 지울 수 있는 권한은 내력이 있어야 한다
--   · 나중에 갈래가 생기면(신고 담당 따로 등) 이 표에 칸만 더하면 된다
--
-- 다시 돌려도 깨지지 않게 썼다. 표와 칸은 if not exists 로, 정책·함수·뷰는 먼저 지우고
-- 다시 만든다 — 0011 과 같은 방식이다.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users on delete cascade,
  /** 왜 준 권한인지. 명단만 보고도 알 수 있어야 나중에 걷어낼 때 헷갈리지 않는다 */
  note       text not null default '',
  /** 준 사람. 맨 처음 관리자는 대시보드에서 직접 넣으므로 비어 있다 */
  granted_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

/**
 * 줄 당시의 아이디.
 *
 * 명단이 가리키는 것은 계정(user_id)이지 아이디가 아니다. 다만 나중에 명단을 훑을 때
 * "그때 누구였더라" 를 알려면 그 시점의 이름이 남아 있어야 한다 — 아이디는 바뀌고,
 * 바뀐 뒤에는 지금 이름만 봐서는 왜 줬는지 이어지지 않는다. 읽기용일 뿐 근거가 아니다.
 */
alter table public.admins add column if not exists handle_at_grant text;

/**
 * 갈래.
 *
 * 값은 정해진 몇 개뿐이고 **알파벳**이다. 코드에서 비교하고 제약으로 막는 값이라
 * 한글을 쓰면 눈에 안 보이는 공백이나 자모 조합 차이로 조용히 어긋난다. 사람이 읽을
 * 말은 note 에 적는다.
 *
 *   owner     앱 주인. 관리자를 임명하고 뺄 수 있다
 *   moderator 신고 처리와 댓글 정리. 남을 임명하지는 못한다
 *
 * 기본값을 moderator 로 둔다. 권한은 좁은 쪽이 기본이어야 한다.
 */
alter table public.admins add column if not exists role text not null default 'moderator';

alter table public.admins drop constraint if exists admins_role_known;
alter table public.admins
  add constraint admins_role_known check (role in ('owner', 'moderator'));

-- 0011 로 이미 켜 둔 사람이 있으면 그대로 옮겨 온다. 여러 번 돌려도 한 번만 들어간다
insert into public.admins (user_id, role, note, handle_at_grant)
select p.id, 'moderator', 'profiles.is_admin 에서 옮겨옴', p.handle
from public.profiles p
where p.is_admin
on conflict (user_id) do nothing;

-- 이제 관리자의 근거는 이 표 하나다
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

/** 관리자를 임명하고 뺄 수 있는 사람. is_admin() 보다 좁다 */
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid() and a.role = 'owner')
$$;

-- 칸은 남겨 둔다. 지우면 0011 을 다시 돌릴 때 그 안의 is_admin() 정의가 깨진다
comment on column public.profiles.is_admin is
  '쓰지 않는다. 관리자 명단은 public.admins 다 (0012 참고)';

alter table public.admins enable row level security;

-- 명단은 관리자끼리만 본다. 누가 관리자인지 밖에 드러날 이유가 없다.
-- is_admin() 은 security definer 라 이 정책에 다시 걸리지 않는다 — 재귀가 생기지 않는다
drop policy if exists "admin read" on public.admins;
create policy "admin read" on public.admins
  for select to authenticated using (public.is_admin());

-- 넣고 빼는 정책은 두지 않는다. 앱에서 직접 쓰는 길을 막고 아래 함수로만 다룬다

-- ─────────────────────────────── 명단 다루기
--
-- **계정 id(uuid)로 받는다. 아이디(handle)로 받지 않는다.**
--
-- 아이디는 지금 이 순간 유일할 뿐 영원히 유일하지 않다. 누가 아이디를 바꾸면 그 이름이
-- 풀리고 다른 사람이 주워 갈 수 있다. 어딘가 적어 둔 `grant_admin('pohang_fan')` 을
-- 한참 뒤에 그대로 돌리면 엉뚱한 사람이 관리자가 된다. 남의 글을 지울 수 있는 권한은
-- **다시 배정될 수 없는 값**으로만 건넨다.
--
-- 그래서 두 걸음이다. 대시보드 SQL 편집기에서
--
--   select * from public.find_user('pohang');                                  -- 누구인지 눈으로 보고
--   select public.grant_admin('00000000-…'::uuid, 'moderator', '2026 시즌');   -- 그 id 로 준다
--   select * from public.admin_list;
--   select public.revoke_admin('00000000-…'::uuid);
--
-- 갈래(owner·moderator)는 위 role 칸 주석에 적어 뒀다. 세 번째 인자는 사람이 읽을 메모라
-- 한글이어도 되고 비워도 된다.
--
-- 한 번에 되지 않는 것이 번거롭지만, 권한을 주는 일은 번거로운 편이 낫다.

-- 옛 모양의 함수를 걷어낸다. 남겨 두면 위험한 길(아이디로 주기)이 열려 있고,
-- 인자 수만 다른 것이 같이 있으면 기본값 때문에 어느 쪽을 부르는지 모호해진다
drop function if exists public.grant_admin(text, text);
drop function if exists public.revoke_admin(text);
drop function if exists public.grant_admin(uuid, text);
drop function if exists public.revoke_admin(uuid);

create or replace function public.can_manage_admins()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- 주인이거나, 앱을 거치지 않는 자리(대시보드 SQL 편집기·서비스 키)여야 한다.
  -- 신고를 처리하는 사람(moderator)이 제 손으로 관리자를 늘릴 수 있으면 안 된다.
  -- 명단이 비어 있는 맨 처음에는 뒤쪽만 통한다 — 그게 첫 주인을 넣는 길이다
  select public.is_owner()
      or coalesce(auth.role(), 'postgres') not in ('anon', 'authenticated')
$$;

/** 아이디나 닉네임 조각으로 사람을 찾는다. 줄 id 를 눈으로 고르라고 있는 것이다 */
create or replace function public.find_user(q text)
returns table (id uuid, handle text, nickname text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_admins() then
    raise exception '앱 주인만 할 수 있습니다';
  end if;

  return query
  select p.id, p.handle, p.nickname, p.created_at
  from public.profiles p
  where p.handle ilike '%' || q || '%'
     or p.nickname ilike '%' || q || '%'
  order by p.created_at
  limit 20;
end
$$;

create or replace function public.grant_admin(
  target uuid,
  admin_role text default 'moderator',
  admin_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  now_handle text;
begin
  if not public.can_manage_admins() then
    raise exception '앱 주인만 할 수 있습니다';
  end if;

  if admin_role not in ('owner', 'moderator') then
    raise exception '그런 갈래가 없습니다: % (owner 나 moderator)', admin_role;
  end if;

  -- 계정 자체가 있어야 한다. 프로필은 아직 없을 수 있으므로 auth.users 를 본다
  if not exists (select 1 from auth.users u where u.id = target) then
    raise exception '그런 계정이 없습니다: %', target;
  end if;

  select p.handle into now_handle from public.profiles p where p.id = target;

  insert into public.admins (user_id, role, note, granted_by, handle_at_grant)
  values (target, admin_role, admin_note, auth.uid(), now_handle)
  on conflict (user_id) do update set role = excluded.role, note = excluded.note;
end
$$;

create or replace function public.revoke_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_admins() then
    raise exception '앱 주인만 할 수 있습니다';
  end if;

  -- 주인을 다 빼면 아무도 관리자를 임명할 수 없다. 되살리는 길은 대시보드뿐이다
  if (select count(*) from public.admins where role = 'owner') <= 1
     and exists (select 1 from public.admins where user_id = target and role = 'owner') then
    raise exception '마지막 주인은 뺄 수 없습니다';
  end if;

  delete from public.admins where user_id = target;
end
$$;

-- 명단을 사람 이름과 함께 본다. security_invoker 라 부르는 사람의 권한으로 읽힌다 —
-- 관리자가 아니면 빈 목록이 나온다.
-- 지금 아이디와 줄 당시의 아이디를 나란히 둔다. 둘이 다르면 그 사이에 이름을 바꾼 것이다
drop view if exists public.admin_list;
create view public.admin_list with (security_invoker = true) as
select a.user_id, a.role, p.handle, a.handle_at_grant, p.nickname, a.note, a.granted_by, a.created_at
from public.admins a
left join public.profiles p on p.id = a.user_id
order by a.created_at;
