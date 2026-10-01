import type { Post, Visibility } from '@/models/community'
import type { PickedPhoto } from '@/utils/pickPhoto'

/**
 * 글쓰기 초안. 새 글과 고치기가 같은 모양을 쓴다.
 *
 * 사진은 두 가지다. 막 고른 것(기기 파일)과 이미 올라가 있는 것(버킷 경로). 저장할 때 앞엣것만
 * 올린다 — 고치기에서 손대지 않은 사진을 다시 올리지 않는다.
 */

export const MAX_PHOTOS = 4
export const BODY_MAX = 1000

export type DraftPhoto =
  { kind: 'local'; key: string; uri: string } | { kind: 'remote'; key: string; path: string }

export interface PostDraft {
  photos: DraftPhoto[]
  /** 직관 글·경기는 본문의 태그가 정한다 (postTags) */
  body: string
  visibility: Visibility
}

export type DraftAction =
  | { type: 'addPhotos'; photos: PickedPhoto[] }
  | { type: 'removePhoto'; key: string }
  | { type: 'movePhoto'; key: string; by: -1 | 1 }
  | { type: 'setBody'; body: string }
  | { type: 'setVisibility'; visibility: Visibility }
  | { type: 'reset'; draft: PostDraft }

export function emptyDraft(): PostDraft {
  return { photos: [], body: '', visibility: 'public' }
}

export function roomForPhotos(draft: PostDraft): number {
  return MAX_PHOTOS - draft.photos.length
}

export function draftReducer(draft: PostDraft, action: DraftAction): PostDraft {
  switch (action.type) {
    case 'addPhotos': {
      // 막 고른 사진의 열쇠는 앨범 id. iOS 는 고를 때마다 새 임시 파일로 복사해 주소로는 같은 사진을
      // 못 알아본다. id 가 없으면 주소로. 같은 것을 두 번 고르면 한 장만 둔다
      const have = new Set(draft.photos.map(p => p.key))
      const fresh: DraftPhoto[] = []
      for (const photo of action.photos) {
        const key = photo.assetId ?? photo.uri
        if (have.has(key) || fresh.length >= roomForPhotos(draft)) continue
        have.add(key)
        fresh.push({ kind: 'local', key, uri: photo.uri })
      }
      return { ...draft, photos: [...draft.photos, ...fresh] }
    }
    case 'removePhoto':
      return { ...draft, photos: draft.photos.filter(p => p.key !== action.key) }
    case 'movePhoto': {
      const from = draft.photos.findIndex(p => p.key === action.key)
      const to = from + action.by
      if (from < 0 || to < 0 || to >= draft.photos.length) return draft
      const photos = [...draft.photos]
      const [moved] = photos.splice(from, 1)
      photos.splice(to, 0, moved!)
      return { ...draft, photos }
    }
    case 'setBody':
      return { ...draft, body: action.body.slice(0, BODY_MAX) }
    case 'setVisibility':
      return { ...draft, visibility: action.visibility }
    case 'reset':
      return action.draft
  }
}

/** 올릴 수 있는지. 서버의 check 와 같은 선(앞뒤 공백을 뺀 1~1,000자) */
export function canSubmit(draft: PostDraft): boolean {
  const length = draft.body.trim().length
  return length >= 1 && length <= BODY_MAX
}

/** 고칠 글을 초안으로. 이미 올라간 사진은 경로로 둔다 — 손대지 않으면 다시 올리지 않는다 */
export function draftFromPost(post: Post): PostDraft {
  return {
    photos: post.photos.map(p => ({ kind: 'remote' as const, key: p.path, path: p.path })),
    body: post.body,
    visibility: post.visibility,
  }
}
