/**
 * 커뮤니티 게시글.
 *
 * 직관 글은 경기 키가 있고 자유 글은 없다. 공개 설정은 게시글의 칸 하나이고, 사진은
 * 그 설정을 따라간다 (0023).
 */

export type Visibility = 'public' | 'private'
export type FeedFilter = 'all' | 'attendance' | 'free'

export const POST_PHOTO_BUCKET = 'post-photos'

/**
 * 사진 캐시 버전. 사진 파일은 이름이 사진마다 새 uuid 이고 한 번 올리면 안 바뀐다(0024). 그래서
 * 글의 updated_at 을 버전으로 쓰지 않는다 — 그러면 본문만 고쳐도 사진을 전부 다시 받는다.
 */
export const POST_PHOTO_VERSION = 'once'

/** 한 번에 받는 글 수 */
export const FEED_PAGE = 20

export interface PostPhoto {
  position: number
  /** 버킷 안 경로 {uid}/{postId}/{photoId} */
  path: string
}

export interface PostMatchKey {
  year: number
  leagueId: number
  gameId: number
}

export interface Post {
  id: string
  authorId: string
  /** 프로필을 아직 안 만든 사람이면 null — 화면이 쓸 말을 정한다 */
  handle: string | null
  nickname: string | null
  avatarUrl: string | null
  body: string
  visibility: Visibility
  /** 직관 글이면 경기, 자유 글이면 null */
  match: PostMatchKey | null
  /** position 순서 */
  photos: PostPhoto[]
  likeCount: number
  /** 내가 좋아요를 눌렀는지. 로그인 전이면 false */
  likedByMe: boolean
  commentCount: number
  createdAt: string
  /** 사진 캐시 버전으로 쓴다 */
  updatedAt: string
}

/** 다음 쪽을 받을 자리. 같은 시각에 쓴 글이 쪽 경계에 걸려도 빠지거나 겹치지 않게 id 도 본다 */
export interface FeedCursor {
  createdAt: string
  id: string
}

export function nextCursor(page: Post[]): FeedCursor | null {
  if (page.length < FEED_PAGE) return null
  const last = page[page.length - 1]!
  return { createdAt: last.createdAt, id: last.id }
}

/** 차단한 사람의 글을 뺀다. 서버는 남의 차단 목록을 모르므로 앱이 거른다 */
export function withoutBlocked(posts: Post[], blocked: string[]): Post[] {
  if (blocked.length === 0) return posts
  const set = new Set(blocked)
  return posts.filter(p => !set.has(p.authorId))
}

/**
 * 글에 적을 이름. 댓글과 같은 규칙이다 — `@아이디`. 닉네임은 겹칠 수 있어서 같은 이름 둘이
 * 서로 다른 사람인지 구별되지 않는다 (2026-09-29). 프로필을 아직 안 만든 사람만 두루 쓰는 말로
 */
export function authorNameOf(post: Pick<Post, 'handle'>): string {
  return post.handle ? `@${post.handle}` : '포항 팬'
}
