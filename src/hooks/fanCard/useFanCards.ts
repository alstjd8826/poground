import { useCallback, useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Directory, File, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'

import { supabase } from '@/repositories/remote/supabase'
import {
  CARD_BUCKET,
  cardPhotoPath,
  deleteCard,
  listMyCards,
  type RemoteCard,
  uploadCardPhoto,
  upsertCard,
} from '@/repositories/fanCard/remote'
import { adoptPrivateImage, isPrivateCacheUri, resolvePrivateImage } from '@/repositories/remote/privateImage'

import { type CardLook, maskedFor } from '@/components/club/PlayerCard'
import type { CardPattern } from '@/components/club/playerCardArt'
import type { ShineKey } from '@/components/holo/shine'
import palette from '@/styles/colors/palette'

/** 내가 만든 카드 한 장. 선수 카드와 달리 전부 직접 고른 값이다 */
export interface FanCard {
  /**
   * uuid.
   *
   * 예전에는 만든 시각(Date.now())을 썼는데, 두 기기에서 같은 밀리초에 만들면 겹치고
   * 로그인 뒤 서버에 모을 때 서로를 덮어쓴다.
   */
  id: string
  name: string
  backNo: string
  /** 카드 위쪽에 작게 붙는 한 줄. 포지션 자리를 쓴다 */
  tagline: string
  /** 카드에 실제로 쓰는 사진. 없으면 실루엣이 나온다 */
  photoUri: string | null
  /**
   * 원본과 누끼를 둘 다 들고 있는다.
   *
   * 누끼가 엉뚱하게 잘리는 사진이 있어서 되돌릴 길을 남겨 둔다. photoUri 는 이 둘 중
   * 지금 쓰는 쪽이고, 누끼를 못 땄으면 cutPhotoUri 가 비어 있다.
   */
  rawPhotoUri: string | null
  cutPhotoUri: string | null
  /**
   * 서버에 올라가 있는 사진의 버킷 안 경로. 서버에서 받은 카드에만 있다.
   *
   * photoUri 와 따로 둔다. 보관함은 사진을 받는 대로 채우므로, 사진이 오기 전이나 받기에
   * 실패하면 photoUri 가 비어 있어도 서버에는 사진이 있다. 예전 대기분에는 이 칸이 없다.
   */
  remotePhotoPath?: string | null
  tint: string
  pattern: CardPattern
  effect: ShineKey
}

export function emptyFanCard(): FanCard {
  return {
    id: randomUUID(),
    name: DEFAULT_NAME,
    backNo: DEFAULT_BACK_NO,
    tagline: 'FAN',
    photoUri: null,
    rawPhotoUri: null,
    cutPhotoUri: null,
    tint: palette.red,
    pattern: 'halo',
    effect: 'brushed',
  }
}

/** 겉모습만 뽑아 카드에 넘긴다 */
export function lookOfFanCard(card: FanCard): CardLook {
  return {
    tint: card.tint,
    pattern: card.pattern,
    effect: card.effect,
    masked: maskedFor(card.effect),
  }
}

/**
 * 새 카드에 미리 채워 두는 값. 입력칸의 안내 글자도 같은 것을 쓴다.
 *
 * 처음부터 뭔가 적혀 있어야 카드가 완성된 모습으로 보인다. 한 곳에서 정해 두면
 * 기본값과 안내 글자가 어긋날 일이 없다.
 */
export const DEFAULT_NAME = '김포항'
export const DEFAULT_BACK_NO = '7'

const STORAGE_KEY = 'fanCards'

/** 사진을 모아 두는 곳. 카드를 지울 때 그 사진도 같이 지운다 */
function photoDir() {
  return new Directory(Paths.document, 'fan-card')
}

/**
 * 사진을 앱 안으로 복사해 둔다.
 *
 * 사진첩에서 고르면 임시 자리에 복사본이 생기는데, 그 자리는 운영체제가 저장 공간이
 * 모자랄 때 언제든 비운다. 저장한 카드의 사진이 며칠 뒤에 사라지면 안 되므로
 * 지워지지 않는 문서 폴더로 한 번 더 옮긴다.
 */
export async function keepPhoto(fromUri: string): Promise<string> {
  const dir = photoDir()
  if (!dir.exists) dir.create({ intermediates: true })
  // 이름에 시각을 넣어 예전 사진과 겹치지 않게 한다. 덮어쓰면 이미지 캐시가 옛 것을 보여준다
  const target = new File(dir, `${Date.now()}.jpg`)
  await new File(fromUri).copy(target)
  return target.uri
}

/** 카드를 지울 때 사진도 같이 치운다. 안 그러면 안 보이는 파일만 쌓인다 */
export function dropPhoto(uri: string | null) {
  if (!uri) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch {
    // 이미 없거나 못 지워도 카드 삭제를 막을 이유는 없다
  }
}

/**
 * 카드 목록을 한 곳에 둔다.
 *
 * 처음에는 훅 안에서 useState 로 들고 있었는데, 화면마다 훅을 따로 부르니 상태도 따로
 * 생겼다. 만들기 화면이 저장하면 저장소에는 들어가는데 보관함 화면은 제 상태를 그대로
 * 들고 있어서 새 카드가 안 보였다 — 앱을 껐다 켜야 나타났다.
 *
 * 그래서 목록을 모듈 하나에 두고 모든 화면이 그것을 구독한다. 누가 바꾸든 전부 같이 바뀐다.
 *
 * ── 서버와 대기분
 *
 * 카드는 두 군데에 있다.
 *
 *   서버   로그인한 사람의 카드. 기기를 바꿔도 따라온다
 *   대기분 로그인 없이 만든 카드. 기기에만 있고, 로그인하면 서버로 올라간다
 *
 * 만드는 것은 로그인 없이 되지만 **저장은 로그인이 필요하다.** 그래서 로그인 전에
 * 저장을 누르면 카드를 대기분에 넣어 두고 로그인을 청한다. 로그인이 끝나면 대기분을
 * 한꺼번에 올린다 — 공들여 만든 카드를 로그인 때문에 버리게 하지 않는다.
 *
 * 화면에는 둘을 합쳐 보여 준다. 대기분이 앞에 오는데, 방금 만든 것이기 때문이다.
 */
let pending: FanCard[] = []
let remote: FanCard[] = []
let merged: FanCard[] = []
let loaded = false
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  // useSyncExternalStore 는 같은 참조면 다시 그리지 않는다. 합친 목록을 새로 만든다
  merged = [...pending, ...remote]
  for (const l of listeners) l()
}

/** 서버 행을 화면이 쓰는 모양으로 옮긴다. 사진은 캐시 파일이 준비된 뒤 채운다 */
function fromRemote(card: RemoteCard, photoUri: string | null): FanCard {
  return {
    id: card.id,
    name: card.name,
    backNo: card.backNo,
    tagline: card.tagline,
    photoUri,
    // 원본·누끼는 기기에만 있던 것이라 서버에서 받은 카드에는 없다.
    // 그래서 누끼 되돌리기는 대기분에서만 쓸 수 있다
    rawPhotoUri: null,
    cutPhotoUri: null,
    remotePhotoPath: card.photoPath,
    tint: card.tint,
    pattern: card.pattern,
    effect: card.effect,
  }
}

const refOf = (card: RemoteCard) =>
  card.photoPath ? { bucket: CARD_BUCKET, path: card.photoPath, version: card.updatedAt } : null

/** 대기분을 한 번만 읽는다. 여러 화면이 동시에 떠도 읽기는 한 번이다 */
function ensureLoaded(): Promise<void> {
  if (loading) return loading
  loading = AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw) as FanCard[]
        if (Array.isArray(parsed)) pending = parsed
      }
    })
    .catch(() => {})
    .finally(() => {
      loaded = true
      emit()
    })
  return loading
}

async function writePending(next: FanCard[]) {
  pending = next
  emit()
  // 화면은 이미 바뀌었다. 적는 데 실패해도 이번 실행은 계속 돈다
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
}

/**
 * 이 기기에 있는 카드를 모두 비운다. 계정을 지운 뒤에 부른다 (2026-09-30).
 *
 * 올라가지 않은 대기분이 남아 있으면 다음에 로그인하는 계정으로 올라가 버린다. 사진 폴더도 같이 치운다.
 */
export async function forgetLocalFanCards(): Promise<void> {
  pending = []
  remote = []
  emit()
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
  try {
    const dir = photoDir()
    if (dir.exists) dir.delete()
  } catch {
    // 못 지운 사진은 가리키는 카드가 없어 보이지 않는다
  }
}

/** 지금 로그인한 사람. 없으면 null */
let userId: string | null = null

/**
 * 서버 카드를 받는다. 글자는 곧바로 보여 주고 사진은 받는 대로 채운다 —
 * 사진 열 장을 다 받을 때까지 보관함이 비어 있으면 안 된다.
 */
async function pullRemote() {
  if (!userId) {
    remote = []
    emit()
    return
  }
  // 받는 사이에 로그인이 바뀌면 늦게 온 목록은 앞 사람 것이다. 기다릴 때마다 다시 본다
  const me = userId
  let rows: RemoteCard[]
  try {
    rows = await listMyCards()
  } catch {
    // 못 받아도 대기분은 그대로 보인다. 다음 로그인/복귀에 다시 시도한다
    return
  }
  if (userId !== me) return
  remote = rows.map(row => fromRemote(row, null))
  emit()

  for (const row of rows) {
    const ref = refOf(row)
    if (!ref) continue
    const uri = await resolvePrivateImage(ref)
    if (userId !== me) return
    if (!uri) continue
    remote = remote.map(c => (c.id === row.id ? { ...c, photoUri: uri } : c))
    emit()
  }
}

/**
 * 저장할 때 사진을 어떻게 할지.
 *
 * 사진이 캐시 파일이면 이미 올라가 있는 것이다. 기기 파일이면 새로 고른 것이라 올린다.
 * 비어 있으면 서버에 있던 경로를 그대로 둔다 — 카드 만들기에는 사진 빼기가 없으므로
 * 비어 있다는 것은 "지워라" 가 아니라 "아직 못 받았다" 다. 여기서 null 을 보내면 보관함이
 * 사진을 채우기 전에 고친 카드에서 사진이 사라진다.
 */
export function photoPlan(card: FanCard, owner: string): { upload: string | null; path: string | null } {
  if (card.photoUri && !isPrivateCacheUri(card.photoUri)) {
    return { upload: card.photoUri, path: cardPhotoPath(owner, card.id) }
  }
  if (card.photoUri) return { upload: null, path: cardPhotoPath(owner, card.id) }
  return { upload: null, path: card.remotePhotoPath ?? null }
}

/** 카드 한 장을 서버에 올린다. 올린 뒤에는 사진을 캐시로 옮겨 두어 다음 저장 때 다시 올리지 않는다 */
async function pushCard(card: FanCard, owner: string): Promise<FanCard> {
  const plan = photoPlan(card, owner)
  if (plan.upload) await uploadCardPhoto(owner, card.id, plan.upload)

  const saved = await upsertCard(owner, {
    id: card.id,
    name: card.name,
    backNo: card.backNo,
    tagline: card.tagline,
    tint: card.tint,
    pattern: card.pattern,
    effect: card.effect,
    photoPath: plan.path,
  })

  const ref = refOf(saved)
  if (!ref) return fromRemote(saved, null)
  // 손에 파일이 있으면 새 버전 이름으로 옮기고, 없으면(아직 못 받은 카드) 받아 본다
  const uri = card.photoUri ? adoptPrivateImage(ref, card.photoUri) : await resolvePrivateImage(ref)
  return fromRemote(saved, uri)
}

/**
 * 대기분을 서버로 올린다. 로그인 직후에 돈다.
 *
 * 한 장이 실패해도 나머지는 올린다 — 사진이 깨진 카드 하나 때문에 전부 기기에 남으면
 * 사용자는 무엇이 문제인지 알 수가 없다. 실패한 것만 대기분에 남는다.
 */
export async function syncPending(): Promise<void> {
  if (!userId || pending.length === 0) return

  const stayed: FanCard[] = []
  for (const card of pending) {
    try {
      const saved = await pushCard(card, userId)
      remote = [saved, ...remote.filter(c => c.id !== saved.id)]
    } catch {
      stayed.push(card)
    }
  }
  await writePending(stayed)
}

/**
 * 로그인 상태를 따라간다.
 *
 * 들어오면 서버 카드를 받아오고 대기분을 올린다. 나가면 서버 카드를 치운다 —
 * 남겨 두면 다음 사람에게 남의 카드가 보인다. 대기분은 기기 것이라 그대로 둔다.
 */
supabase.auth.getSession().then(({ data }) => {
  const next = data.session?.user.id ?? null
  // 구독이 먼저 같은 사람으로 받아 갔으면 두 번 받지 않는다
  if (next === userId) return
  userId = next
  if (userId) void pullRemote().then(syncPending)
})

supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id ?? null
  if (next === userId) return
  userId = next
  if (userId) void pullRemote().then(syncPending)
  else {
    remote = []
    emit()
  }
})

/** 저장 결과. 로그인이 필요했는지를 호출부가 알아야 안내를 띄울 수 있다 */
export interface SaveResult {
  /** 대기분에만 들어갔다. 로그인하면 올라간다 */
  needsLogin: boolean
}

/**
 * 내가 만든 카드들.
 *
 * 서버 카드와 대기분을 합쳐 돌려준다. 최근에 만든 것이 앞에 온다.
 */
/**
 * 기다리는 목록에 카드를 넣는다.
 *
 * 같은 id 가 이미 있으면 갈아 끼우고, 없으면 맨 앞에 붙인다. 로그인 전에 만든 카드는
 * 여기 쌓였다가 로그인할 때 서버로 올라간다.
 */
function withCard(pending: FanCard[], card: FanCard): FanCard[] {
  const found = pending.some(c => c.id === card.id)
  if (!found) return [card, ...pending]
  return pending.map(c => {
    if (c.id === card.id) return card
    return c
  })
}

export function useFanCards() {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  const cards = useSyncExternalStore(
    subscribe,
    () => merged,
    () => merged,
  )
  const isLoaded = useSyncExternalStore(
    subscribe,
    () => loaded,
    () => loaded,
  )

  useEffect(() => {
    void ensureLoaded()
  }, [])

  /**
   * 카드를 저장한다.
   *
   * 로그인했으면 곧바로 서버에 올린다. 안 했으면 대기분에 넣고 needsLogin 을 돌려준다 —
   * 화면이 그걸 보고 로그인을 청한다.
   */
  const save = useCallback(async (card: FanCard): Promise<SaveResult> => {
    if (!userId) {
      await writePending(withCard(pending, card))
      return { needsLogin: true }
    }

    const saved = await pushCard(card, userId)
    remote = [saved, ...remote.filter(c => c.id !== saved.id)]
    // 고치던 것이 대기분에 있었으면 이제 서버로 갔으니 기기에서 뺀다
    await writePending(pending.filter(c => c.id !== saved.id))
    return { needsLogin: false }
  }, [])

  const remove = useCallback(async (id: string) => {
    const gone = merged.find(c => c.id === id)

    // 원본과 누끼가 서로 다른 파일이므로 둘 다 치운다
    dropPhoto(gone?.rawPhotoUri ?? null)
    dropPhoto(gone?.cutPhotoUri ?? null)

    if (userId && remote.some(c => c.id === id)) {
      try {
        await deleteCard(userId, id)
      } catch {
        // 서버에서 못 지웠으면 목록에서도 빼지 않는다. 사라진 척하면 다음에 다시 나타난다
        return
      }
      remote = remote.filter(c => c.id !== id)
      emit()
    }

    await writePending(pending.filter(c => c.id !== id))
  }, [])

  return { cards, loaded: isLoaded, save, remove }
}
