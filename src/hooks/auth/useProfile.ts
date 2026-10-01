import { useCallback, useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/repositories/remote/supabase'
import { displayNameOf } from '@/hooks/auth/useAuth'
import { checkHandle, handleProblemMessage, normalizeHandle, randomHandle } from '@/utils/handle'
import { normalizeKakaoAvatar, removeAvatar, uploadAvatar } from '@/hooks/auth/avatar'
import { TERMS_VERSION } from '@/content/terms'

/**
 * 앱 안에서 쓰는 내 이름.
 *
 * 카카오가 준 닉네임과 따로 둔다 — 카카오에서 이름을 바꿔도 여기는 안 따라오고,
 * 반대로 여기서 바꿔도 카카오 계정은 건드리지 않는다.
 *
 * **행이 없는 상태가 "아직 안 정했다" 는 신호다.** 그래서 가입할 때 자동으로 만들지
 * 않는다 (0006_profiles.sql 주석 참고). 첫 로그인에서 닉네임을 받아 그때 만든다.
 */
export interface Profile {
  id: string
  nickname: string
  /** @로 가리키는 이름. 가입할 때 자동으로 받는다 */
  handle: string
  avatarUrl: string | null
  /** 동의한 약관 판. 0 이면 아직 안 했다 (0029). 지금 판은 content/terms 의 TERMS_VERSION */
  termsVersion: number
}

/** 닉네임 길이. DB 의 check 제약과 같은 값이어야 한다 */
export const NICKNAME_MAX = 20

/** 프로필에서 읽는 칸. terms_version 은 0029 에서 생겼다 — 0029 를 먼저 돌리고 앱을 깐다 */
const PROFILE_COLUMNS = 'id, nickname, handle, avatar_url, terms_version'

type State = {
  profile: Profile | null
  /** 조회가 끝났는지. 끝나기 전에는 "없음" 과 구분이 안 된다 */
  loaded: boolean
}

let state: State = { profile: null, loaded: false }
let loadingFor: string | null = null
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  listeners.forEach(fn => fn())
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** 카카오가 준 값에서 처음 보여 줄 이름을 고른다. 없으면 빈 칸으로 둔다 */
export function suggestedNickname(session: Session | null): string {
  return displayNameOf(session).slice(0, NICKNAME_MAX)
}

function avatarOf(session: Session | null): string | null {
  const meta = session?.user.user_metadata as Record<string, unknown> | undefined
  const url = meta?.avatar_url ?? meta?.picture
  return normalizeKakaoAvatar(typeof url === 'string' ? url : null)
}

/**
 * 세션이 바뀔 때마다 한 번 읽는다.
 *
 * 같은 사용자를 두 번 읽지 않도록 loadingFor 로 잠근다 — 화면 여러 곳이 이 훅을
 * 쓰는데, 각자 조회를 걸면 첫 로그인 직후 같은 질의가 여러 번 나간다.
 */
async function load(userId: string) {
  if (loadingFor === userId) return
  loadingFor = userId

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    // 못 읽었으면 "없음" 으로 단정하지 않는다. 없다고 보면 닉네임 화면이 또 뜬다
    loadingFor = null
    return
  }

  set({ profile: data ? toProfile(data) : null, loaded: true })
}

type Row = {
  id: string
  nickname: string
  handle: string
  avatar_url: string | null
  terms_version: number
}

function toProfile(row: Row): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    handle: row.handle,
    // 이미 저장돼 있는 카카오 기본 이미지도 읽을 때 걸러낸다. 행을 고치지 않아도
    // 화면은 바로 제대로 나온다
    avatarUrl: normalizeKakaoAvatar(row.avatar_url),
    termsVersion: row.terms_version ?? 0,
  }
}

/** 유일 제약 위반. 이름이 겹쳤다는 뜻이라 다시 뽑아 보면 된다 */
const UNIQUE_VIOLATION = '23505'

/**
 * 아이디를 정해 프로필을 만든다.
 *
 * 먼저 "이 이름 있나" 를 물어보고 넣지 않는다. 묻고 넣는 사이에 남이 가져갈 수 있고,
 * 그러면 어차피 실패를 처리해야 한다. 그냥 넣어 보고 겹치면 다시 뽑는다 —
 * DB 의 유일 인덱스가 판정을 맡는 쪽이 경쟁 상태가 없다.
 *
 * 꼬리가 4자라 한 낱말당 80만 가지다. 세 번이면 사실상 안 겹치고, 그래도 겹치면
 * 실패로 알린다 (조용히 포기하면 프로필 없는 계정이 남는다).
 */
async function createProfile(userId: string, nickname: string, avatarUrl: string | null): Promise<Profile> {
  let lastError: unknown = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({ id: userId, nickname, handle: randomHandle(), avatar_url: avatarUrl })
      .select(PROFILE_COLUMNS)
      .single()

    if (!error) return toProfile(data)
    if (error.code !== UNIQUE_VIOLATION) throw error
    lastError = error
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('아이디를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요')
}

export function resetProfile() {
  loadingFor = null
  set({ profile: null, loaded: false })
}

supabase.auth.onAuthStateChange((_event, session) => {
  const id = session?.user.id
  if (!id) {
    resetProfile()
    return
  }
  if (state.profile?.id !== id) resetProfile()
  void load(id)
})

export interface ProfileState {
  profile: Profile | null
  loaded: boolean
  /** 닉네임을 저장한다. 행이 없으면 만들고, 있으면 고친다 */
  save: (nickname: string) => Promise<void>
  /** 아이디를 바꾼다. 남이 쓰는 이름이면 거부된다 */
  saveHandle: (handle: string) => Promise<void>
  /** 고른 사진을 프로필 이미지로 올린다 */
  saveAvatar: (localUri: string) => Promise<void>
  /** 올린 사진을 치운다. 카카오가 준 사진으로 되돌아간다 */
  clearAvatar: () => Promise<void>
  /** 지금 판 약관에 동의한다. 시각은 서버가 적는다 (0029) */
  agreeTerms: () => Promise<void>
}

export function useProfile(session: Session | null): ProfileState {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  )

  // 앱을 켠 직후에는 onAuthStateChange 가 아직 안 울렸을 수 있다
  const userId = session?.user.id
  if (userId && !current.loaded && loadingFor === null) void load(userId)

  const save = useCallback(
    async (nickname: string) => {
      const trimmed = nickname.trim()
      if (!userId) throw new Error('로그인이 필요합니다')
      if (trimmed.length === 0) throw new Error('닉네임을 입력해 주세요')
      if (trimmed.length > NICKNAME_MAX) throw new Error(`닉네임은 ${NICKNAME_MAX}자까지입니다`)

      // 만들기와 고치기를 가른다. upsert 로 뭉치면 닉네임만 보낼 때 handle 이 빠져
      // not null 제약에 걸린다 — 이미 받은 아이디를 지울 이유가 없다
      if (state.profile?.id === userId) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ nickname: trimmed })
          .eq('id', userId)
          .select(PROFILE_COLUMNS)
          .single()
        if (error) throw error
        set({ profile: toProfile(data), loaded: true })
        return
      }

      const profile = await createProfile(userId, trimmed, avatarOf(session))
      set({ profile, loaded: true })
    },
    [session, userId],
  )

  const saveHandle = useCallback(
    async (handle: string) => {
      if (!userId) throw new Error('로그인이 필요합니다')

      const next = normalizeHandle(handle)
      const problem = checkHandle(next)
      if (problem) throw new Error(handleProblemMessage(problem))
      if (next === state.profile?.handle) return

      const { data, error } = await supabase
        .from('profiles')
        .update({ handle: next })
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single()

      if (error) {
        // 유일 제약이 잡아 주는 것이 "먼저 물어보기" 보다 정확하다.
        // 물어본 뒤 넣는 사이에 남이 가져갈 수 있다
        if (error.code === UNIQUE_VIOLATION) throw new Error('이미 누가 쓰고 있어요')
        throw error
      }

      set({ profile: toProfile(data), loaded: true })
    },
    [userId],
  )

  const saveAvatar = useCallback(
    async (localUri: string) => {
      if (!userId) throw new Error('로그인이 필요합니다')

      const url = await uploadAvatar(userId, localUri, state.profile?.avatarUrl ?? null)

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single()
      if (error) throw error

      set({ profile: toProfile(data), loaded: true })
    },
    [userId],
  )

  const clearAvatar = useCallback(async () => {
    if (!userId) throw new Error('로그인이 필요합니다')

    const previous = state.profile?.avatarUrl ?? null
    // 카카오가 준 사진이 있으면 그것으로 되돌아간다. 없으면 빈 값
    const fallback = avatarOf(session)
    const next = fallback === previous ? null : fallback

    const { data, error } = await supabase
      .from('profiles')
      .update({ avatar_url: next })
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single()
    if (error) throw error

    set({ profile: toProfile(data), loaded: true })

    // 행을 고친 뒤에 파일을 지운다. 먼저 지우면 실패했을 때 깨진 주소가 남는다
    await removeAvatar(previous).catch(() => {})
  }, [session, userId])

  const agreeTerms = useCallback(async () => {
    if (!userId) throw new Error('로그인이 필요합니다')
    const { error } = await supabase.rpc('agree_terms', { p_version: TERMS_VERSION })
    if (error) throw new Error(error.message)
    const profile = state.profile
    if (profile?.id === userId) {
      set({
        profile: { ...profile, termsVersion: Math.max(profile.termsVersion, TERMS_VERSION) },
        loaded: true,
      })
    }
  }, [userId])

  return {
    profile: current.profile,
    loaded: current.loaded,
    save,
    saveHandle,
    saveAvatar,
    clearAvatar,
    agreeTerms,
  }
}
