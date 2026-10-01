import { randomUUID } from 'expo-crypto'

import { supabase } from '@/repositories/remote/supabase'
import { uploadPrivateImage } from '@/repositories/remote/imageUpload'
import {
  FEED_PAGE,
  type FeedCursor,
  type FeedFilter,
  type Post,
  type PostMatchKey,
  POST_PHOTO_BUCKET,
  type Visibility,
} from '@/models/community'
import type { PostDraft } from '@/models/postDraft'
import { ATTENDANCE_TAG_PATTERN } from '@/models/postTags'

/**
 * 게시글을 읽는 곳. 쓰기는 2단계.
 *
 * 글쓴이 프로필과 통계는 따로 받아 합친다 — 댓글 저장소와 같은 방식이다. 게시글은
 * auth.users 를 가리켜 profiles 와 바로 이을 외래키가 없다.
 */

export interface PostRow {
  id: string
  author: string
  body: string
  visibility: Visibility
  match_year: number | null
  match_league_id: number | null
  match_game_id: number | null
  created_at: string
  updated_at: string
  post_photos: { position: number; path: string }[] | null
}

export interface PostProfileRow {
  id: string
  handle: string | null
  nickname: string | null
  avatar_url: string | null
}

export interface PostStatsRow {
  post_id: string
  like_count: number
  comment_count: number
}

const COLUMNS =
  'id,author,body,visibility,match_year,match_league_id,match_game_id,created_at,updated_at,post_photos(position,path)'

export function toPost(
  row: PostRow,
  profiles: Map<string, PostProfileRow>,
  stats: Map<string, PostStatsRow>,
  liked: Set<string> = new Set(),
): Post {
  const profile = profiles.get(row.author)
  const stat = stats.get(row.id)
  const hasMatch = row.match_year !== null && row.match_league_id !== null && row.match_game_id !== null
  return {
    id: row.id,
    authorId: row.author,
    handle: profile?.handle ?? null,
    nickname: profile?.nickname ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    body: row.body,
    visibility: row.visibility,
    match: hasMatch
      ? { year: row.match_year!, leagueId: row.match_league_id!, gameId: row.match_game_id! }
      : null,
    photos: [...(row.post_photos ?? [])].sort((a, b) => a.position - b.position),
    likeCount: stat?.like_count ?? 0,
    likedByMe: liked.has(row.id),
    commentCount: stat?.comment_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** 이 글들 가운데 내가 좋아요 누른 것. 로그인 전이면 묻지 않는다 */
async function likedAmong(ids: string[]): Promise<Set<string>> {
  // 세션은 기기에 적어 둔 것을 읽는다. 네트워크를 타지 않는다
  const { data } = await supabase.auth.getSession()
  const me = data.session?.user.id
  if (!me) return new Set()
  const { data: rows, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', me)
    .in('post_id', ids)
  if (error) throw error
  return new Set((rows as { post_id: string }[]).map(r => r.post_id))
}

/** 글 목록에 프로필·통계·내 좋아요를 붙인다. 세 번 더 묻는다 — 글이 없으면 묻지 않는다 */
async function hydrate(rows: PostRow[]): Promise<Post[]> {
  if (rows.length === 0) return []
  const authors = [...new Set(rows.map(r => r.author))]
  const ids = rows.map(r => r.id)
  const [profiles, stats, liked] = await Promise.all([
    supabase.from('profiles').select('id,handle,nickname,avatar_url').in('id', authors),
    supabase.from('post_stats').select('post_id,like_count,comment_count').in('post_id', ids),
    likedAmong(ids),
  ])
  if (profiles.error) throw profiles.error
  if (stats.error) throw stats.error
  const who = new Map((profiles.data as PostProfileRow[]).map(p => [p.id, p]))
  const counts = new Map((stats.data as PostStatsRow[]).map(s => [s.post_id, s]))
  return rows.map(r => toPost(r, who, counts, liked))
}

/**
 * 공개 글 한 쪽. 최신순.
 *
 * 커서는 마지막 글의 (작성 시각, id). 시각만 보면 같은 시각의 글이 쪽 경계에서 빠지거나
 * 두 번 온다. 나만 보기 글은 RLS 가 내 것도 돌려주므로 여기서 공개만 고른다.
 */
export async function listFeed(filter: FeedFilter, cursor: FeedCursor | null): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(COLUMNS)
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_PAGE)
  // 직관 글은 본문의 #직관 으로 가른다. 경기를 안 골라도 직관 글이다 (postTags)
  if (filter === 'attendance') query = query.filter('body', 'match', ATTENDANCE_TAG_PATTERN)
  if (filter === 'free') query = query.not('body', 'match', ATTENDANCE_TAG_PATTERN)
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    )
  }
  const { data, error } = await query
  if (error) throw error
  return hydrate((data ?? []) as PostRow[])
}

/** 직관 기록에 한 번에 띄우는 내 직관 글 수. 몇 시즌 치 직관을 다 담는다 */
const MY_ATTENDANCE_LIMIT = 200

/**
 * 내 직관 글. 직관 기록 화면이 쓴다 (4단계).
 *
 * 직관 글은 본문의 #직관 으로 가른다(피드 거르개와 같다). 공개 여부로 거르지 않는다 — 나만 보기 글은
 * 커뮤니티 피드에 없어서, 다시 찾아 들어갈 곳이 여기다. 글쓴이는 부르는 쪽이 넘긴 내 id 로 묻는다.
 */
export async function listMyAttendancePosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('author', userId)
    .is('deleted_at', null)
    .filter('body', 'match', ATTENDANCE_TAG_PATTERN)
    .order('created_at', { ascending: false })
    .limit(MY_ATTENDANCE_LIMIT)
  if (error) throw error
  return hydrate((data ?? []) as PostRow[])
}

/** 글 하나. 볼 수 없거나 지워졌으면 null (RLS 가 가린다) */
export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const [post] = await hydrate([data as PostRow])
  return post ?? null
}

/** 사진 폭. 직관 사진과 같다 — 폰 화면 두 배 남짓이면 넘길 때도 뭉개지지 않는다 */
const PHOTO_WIDTH = 1600

/** 버킷 안 경로. 첫 칸은 사용자, 둘째는 글. 스토리지 정책이 이 두 칸을 본다(0023) */
export function postPhotoPath(userId: string, postId: string, photoId: string): string {
  return `${userId}/${postId}/${photoId}`
}

export interface SavePostInput {
  /** 새 글이면 화면이 미리 만든 uuid. 사진 경로에 들어가므로 글보다 먼저 정한다 */
  postId: string
  userId: string
  draft: PostDraft
  /** 본문의 경기 태그로 찾은 경기. 없으면 null (postTags) */
  match: PostMatchKey | null
  /** 고치기 전 사진 경로. 새 글이면 [] */
  previousPaths: string[]
}

/** Postgres unique_violation */
const UNIQUE_VIOLATION = '23505'

export interface SavedPost {
  id: string
  updatedAt: string
  /** 이번에 올린 사진. 부르는 쪽이 기기 파일을 캐시에 넣어 다시 받지 않게 한다 */
  uploaded: { path: string; localUri: string }[]
  /** 이번에 뺀 사진. 부르는 쪽이 기기 캐시에서도 비운다 */
  removed: string[]
}

/** 못 지운 파일은 남겨 둔다. 글이 가리키지 않는 파일이라 화면에 틀린 것이 나오지는 않는다 */
async function removeQuietly(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await supabase.storage.from(POST_PHOTO_BUCKET).remove(paths)
  } catch {
    // 위와 같다
  }
}

/**
 * 글을 만들거나 고친다.
 *
 * 새 사진을 먼저 올리고, 글과 사진 행은 save_post() 한 번으로 쓴다 — 반쪽 글이 피드에 보이지
 * 않는다. 사진이든 글이든 실패하면 이번에 올린 사진을 지우고 던진다. 초안은 화면이 들고 있다.
 *
 * 뺀 사진 파일은 글을 저장한 **뒤에** 지운다. 그 정리는 실패해도 던지지 않는다 — 여기서
 * 던지면 부르는 쪽이 실패로 알고, 새 사진까지 지우는 길로 빠지면 방금 저장한 글이 깨진다.
 */
export async function savePost(input: SavePostInput, newId: () => string = randomUUID): Promise<SavedPost> {
  const { postId, userId, draft, match, previousPaths } = input
  const uploaded: SavedPost['uploaded'] = []
  const paths: string[] = []
  let updatedAt: string

  try {
    for (const photo of draft.photos) {
      if (photo.kind === 'remote') {
        paths.push(photo.path)
        continue
      }
      const path = postPhotoPath(userId, postId, newId())
      await uploadPrivateImage(POST_PHOTO_BUCKET, path, photo.uri, PHOTO_WIDTH, { upsert: false })
      uploaded.push({ path, localUri: photo.uri })
      paths.push(path)
    }

    const { data, error } = await supabase.rpc('save_post', {
      p_id: postId,
      p_body: draft.body.trim(),
      p_visibility: draft.visibility,
      p_match_year: match?.year ?? null,
      p_match_league_id: match?.leagueId ?? null,
      p_match_game_id: match?.gameId ?? null,
      p_paths: paths,
    })
    // 고치는 사이 글이 지워졌거나 내 글이 아니면 update 는 0 행이고, 이어지는 insert 가 기본 키에
    // 걸린다(0024). 'duplicate key' 를 그대로 보이면 무슨 일인지 알 수 없다
    if (error?.code === UNIQUE_VIOLATION) throw new Error('글을 찾을 수 없습니다. 지워졌을 수 있습니다')
    if (error) throw error
    updatedAt = data as string
  } catch (e) {
    await removeQuietly(uploaded.map(u => u.path))
    throw e
  }

  const removed = previousPaths.filter(p => !paths.includes(p))
  await removeQuietly(removed)
  return { id: postId, updatedAt, uploaded, removed }
}

/**
 * 내 글을 지운다. 소프트 삭제다 — 지운 사람과 시각은 서버가 적는다(posts_guard).
 *
 * 사진 파일은 치운다. 지운 글의 사진은 이미 아무도 못 열지만(읽기 정책) 남겨 둘 이유가 없다.
 */
export async function deletePost(post: Pick<Post, 'id' | 'photos'>): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', post.id)
  if (error) throw error
  await removeQuietly(post.photos.map(p => p.path))
}

/** 좋아요. 볼 수 없는 글이면 정책이 막는다(0023) */
export async function likePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
  if (error) throw error
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (error) throw error
}

/**
 * 게시글 신고. 같은 사람이 같은 글을 다시 신고하면 조용히 넘긴다 — 표에는 insert 정책만 있어
 * 덮어쓰기(update)로 가면 막힌다. 처음 사유가 남는 것이 맞다(댓글 신고와 같다). 볼 수 없는 글은
 * 정책이 막는다(0025)
 */
export async function reportPost(postId: string, reporter: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('post_reports')
    .upsert({ post_id: postId, reporter, reason }, { onConflict: 'post_id,reporter', ignoreDuplicates: true })
  if (error) throw error
}

/** 관리자가 남의 글을 내린다. 읽기 정책을 거치지 않는 서버 함수로(0023) */
export async function adminDeletePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_post', { p_id: postId })
  if (error) throw error
}
