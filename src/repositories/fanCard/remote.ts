import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'
import type { CardPattern } from '@/components/club/playerCardArt'
import type { ShineKey } from '@/components/holo/shine'

/**
 * 카드를 서버에 두고 읽는 곳.
 *
 * 화면이 쓰는 모양(FanCard)과 DB 행 모양을 여기서 맞춘다 — 다른 수집 자료와 같은
 * 방식이다 (services/kleague/mappers.ts).
 */

export const CARD_BUCKET = 'fan-cards'

/** 카드 사진 폭. 선수 사진과 같은 카드에 같은 크기로 얹는다 */
const CARD_PHOTO_WIDTH = 1000

export interface RemoteCard {
  id: string
  name: string
  backNo: string
  tagline: string
  tint: string
  pattern: CardPattern
  effect: ShineKey
  /** 버킷 안 경로. 사진 없이 만든 카드는 null */
  photoPath: string | null
  /** 캐시 파일 이름의 버전으로 쓴다 */
  updatedAt: string
}

interface Row {
  id: string
  name: string
  back_no: string
  tagline: string
  tint: string
  pattern: string
  effect: string
  photo_path: string | null
  updated_at: string
}

const LEGACY_PREFIX = `/storage/v1/object/public/${CARD_BUCKET}/`

/**
 * 표에 적힌 값을 버킷 안 경로로 읽는다.
 *
 * 예전에는 공개 주소를 통째로 적었다. 0019 가 경로로 바꾸지만, 놓친 행이 있어도
 * 사진이 사라지지 않게 여기서 한 번 더 가른다.
 */
export function storedPhotoPath(value: string | null): string | null {
  if (!value) return null
  const at = value.indexOf(LEGACY_PREFIX)
  if (at < 0) return value
  return value.slice(at + LEGACY_PREFIX.length).split('?')[0] || null
}

function toRemote(row: Row): RemoteCard {
  return {
    id: row.id,
    name: row.name,
    backNo: row.back_no,
    tagline: row.tagline,
    tint: row.tint,
    pattern: row.pattern as CardPattern,
    effect: row.effect as ShineKey,
    photoPath: storedPhotoPath(row.photo_path),
    updatedAt: row.updated_at,
  }
}

const COLUMNS = 'id, name, back_no, tagline, tint, pattern, effect, photo_path, updated_at'

/** 내 카드 전부. 최근에 만든 것이 앞에 온다 */
export async function listMyCards(): Promise<RemoteCard[]> {
  const { data, error } = await supabase
    .from('fan_cards')
    .select(COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data as Row[]).map(toRemote)
}

/**
 * 사진 저장 경로.
 *
 * 맨 앞 칸이 사용자 id 여야 한다 — 스토리지 정책이 그 칸만 보고 주인을 가린다
 * (0009_fan_cards.sql). 카드 id 를 파일 이름으로 쓰면 카드 하나에 사진 하나로
 * 묶이고, 고칠 때 옛 파일을 따로 찾지 않아도 된다.
 */
export function cardPhotoPath(userId: string, cardId: string): string {
  return `${userId}/${cardId}.jpg`
}

/**
 * 기기에 있는 사진을 올리고 버킷 안 경로를 돌려준다.
 *
 * 경로가 카드 id 로 고정이라 같은 카드를 고치면 같은 자리를 덮어쓴다. 버전은 표의
 * updated_at 이 맡으므로 주소 끝에 시각을 달 필요가 없어졌다.
 */
export async function uploadCardPhoto(userId: string, cardId: string, localUri: string): Promise<string> {
  const path = cardPhotoPath(userId, cardId)
  await uploadPrivateImage(CARD_BUCKET, path, localUri, CARD_PHOTO_WIDTH)
  return path
}

export async function upsertCard(userId: string, card: Omit<RemoteCard, 'updatedAt'>): Promise<RemoteCard> {
  const { data, error } = await supabase
    .from('fan_cards')
    .upsert({
      id: card.id,
      owner: userId,
      name: card.name,
      back_no: card.backNo,
      tagline: card.tagline,
      tint: card.tint,
      pattern: card.pattern,
      effect: card.effect,
      photo_path: card.photoPath,
    })
    .select(COLUMNS)
    .single()

  if (error) throw error
  return toRemote(data as Row)
}

/**
 * 카드를 지운다. 사진도 같이 치운다.
 *
 * 행을 먼저 지운다 — 사진만 지우고 행이 남으면 깨진 그림이 보이는데, 행이 먼저
 * 사라지면 사진은 아무도 안 보는 파일이 될 뿐이다.
 */
export async function deleteCard(userId: string, cardId: string): Promise<void> {
  const { error } = await supabase.from('fan_cards').delete().eq('id', cardId)
  if (error) throw error

  await supabase.storage.from(CARD_BUCKET).remove([cardPhotoPath(userId, cardId)])
}
