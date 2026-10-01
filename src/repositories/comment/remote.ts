import { supabase } from '@/repositories/remote/supabase'

/**
 * 경기 댓글을 서버에 두고 읽는 곳.
 *
 * 화면이 쓰는 모양과 DB 행 모양을 여기서 맞춘다 — 다른 자료와 같은 방식이다
 * (services/kleague/mappers.ts).
 *
 * 작성자 아이디와 사진은 **따로 한 번** 더 읽어 합친다.
 *
 * 한 질의로 끼워 받을 수는 없다. comments.author 는 auth.users 를 가리키고
 * profiles 도 auth.users 를 가리킬 뿐, 둘 사이에는 외래키가 없어서 PostgREST 가
 * 관계를 찾지 못한다 (PGRST200).
 *
 * 그렇다고 author 를 profiles 로 걸 수도 없다. 이 앱은 프로필 행이 없는 상태를
 * "아직 닉네임을 안 정했다" 는 신호로 쓴다 (0006 주석). 외래키를 걸면 그 상태에서
 * 댓글 쓰기가 막힌다.
 *
 * 그래서 두 번 묻고 여기서 합친다. 댓글마다 묻는 것이 아니라 등장한 사람 수만큼
 * 한 번이므로 왕복은 늘 둘이다.
 */

/**
 * 댓글이 붙는 대상.
 *
 * 경기·선수·소식이 한 표를 쓴다(0015, 0016). id 가 문자열인 것은 셋을 한 칸에 담기
 * 위해서다 — 경기와 소식은 숫자지만 선수는 문자열이라 넓은 쪽으로 맞췄다.
 */
export interface CommentSubject {
  type: 'match' | 'player' | 'news' | 'post'
  id: string
}

/** 화면이 쓰는 댓글 한 줄 */
export interface Comment {
  id: string
  /** 대댓글이면 부모. 맨 위 댓글이면 null */
  parentId: string | null
  /** 탈퇴한 사람의 댓글이면 null. 그 댓글은 지워진 자리로만 남는다 (0029) */
  authorId: string | null
  /**
   * 보여줄 이름은 **아이디** 다. 닉네임은 겹칠 수 있어서 같은 이름 둘이 서로 다른
   * 사람인지 알 길이 없다. 아이디는 유일하다 (0007_profile_handle.sql).
   *
   * 프로필 행이 아직 없으면 null 이다 — 화면이 그때 쓸 말을 정한다.
   */
  handle: string | null
  avatarUrl: string | null
  /** 지워졌으면 빈 문자열. 자리는 남고 내용만 사라진다 */
  body: string
  deleted: boolean
  /**
   * 관리자가 걷어낸 글인지. 글쓴이가 스스로 내린 것과 달리 보여 줘야 한다 —
   * 무엇이 규칙에 걸리는지 읽는 사람도 알게 된다 (0013).
   */
  deletedByAdmin: boolean
  createdAt: string
  likeCount: number
  /** 내가 좋아요를 눌렀는지. 로그인 전이면 false */
  likedByMe: boolean
}

interface Row {
  id: string
  parent_id: string | null
  author: string | null
  body: string
  deleted_at: string | null
  deleted_by_admin: boolean
  created_at: string
}

interface ProfileRow {
  id: string
  handle: string
  avatar_url: string | null
}

function toComment(
  row: Row,
  who: Map<string, ProfileRow>,
  likes: Map<string, number> = new Map(),
  liked: Set<string> = new Set(),
): Comment {
  const deleted = row.deleted_at !== null
  const profile = row.author ? who.get(row.author) : undefined
  return {
    id: row.id,
    parentId: row.parent_id,
    authorId: row.author,
    handle: profile?.handle ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    body: deleted ? '' : row.body,
    deleted,
    deletedByAdmin: deleted && row.deleted_by_admin,
    createdAt: row.created_at,
    likeCount: likes.get(row.id) ?? 0,
    likedByMe: liked.has(row.id),
  }
}

/** 한 번에 받아 오는 맨 위 댓글 수. 답글은 그 아래 딸려 온다 */
export const COMMENT_PAGE = 20

const COMMENT_COLUMNS = 'id,parent_id,author,body,deleted_at,deleted_by_admin,created_at'

export interface CommentPage {
  comments: Comment[]
  /** 맨 위 댓글이 모두 몇 개인지. "더 보기" 에 남은 수를 적으려면 필요하다 */
  totalRoots: number
}

/**
 * 댓글 한 쪽.
 *
 * 전부 받아 놓고 앱에서 잘라 보여 주던 것을 서버에서 끊는다. 한 경기에 댓글이 수백 개
 * 쌓이면 볼 것은 스무 개인데 받는 것은 전부가 되고, PostgREST 는 한 번에 1000행에서
 * **조용히 잘라** 보내므로 그 너머는 없는 것이 된다.
 *
 * 끊는 단위는 **맨 위 댓글**이다. 평평한 목록을 그냥 자르면 부모가 다음 쪽에 있는
 * 답글이 먼저 도착해 뿌리 없는 답글로 떠 버린다. 그래서 맨 위 댓글을 먼저 한 쪽 받고,
 * 그것들에 달린 답글을 한 번에 받아 붙인다.
 *
 * 맨 위 댓글은 **최신이 앞**이다. 오래된 것부터 두면 방금 쓴 댓글이 마지막 쪽에 놓여,
 * 올리고 나서 "더 보기" 를 끝까지 눌러야 제 글이 보인다. 답글은 반대로 오래된 것부터
 * 둔다 — 그쪽은 대화라 순서가 뒤집히면 말이 안 된다.
 */
export async function listCommentPage(subject: CommentSubject, page: number): Promise<CommentPage> {
  const from = page * COMMENT_PAGE
  const {
    data: rootData,
    count,
    error,
  } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS, { count: 'exact' })
    .eq('subject_type', subject.type)
    .eq('subject_id', subject.id)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .range(from, from + COMMENT_PAGE - 1)
  if (error) throw error

  const roots = (rootData ?? []) as Row[]
  const totalRoots = count ?? roots.length
  if (roots.length === 0) return { comments: [], totalRoots }

  const { data: replyData, error: replyError } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .in(
      'parent_id',
      roots.map(r => r.id),
    )
    .order('created_at', { ascending: true })
  if (replyError) throw replyError

  const rows = [...roots, ...((replyData ?? []) as Row[])]
  const ids = [...new Set(rows.flatMap(r => (r.author ? [r.author] : [])))]
  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id,handle,avatar_url')
    .in('id', ids)
  // 이름을 못 읽어도 댓글은 보여 준다. 이름 없이 뜨는 편이 빈 화면보다 낫다
  const who = new Map((peopleError ? [] : ((people ?? []) as ProfileRow[])).map(p => [p.id, p]))

  // 좋아요 수와 내가 누른 것. 못 읽어도 댓글은 보여 준다 — 0 으로 뜨는 편이 빈 화면보다 낫다
  const commentIds = rows.map(r => r.id)
  const [stats, liked] = await Promise.all([
    supabase.from('comment_like_stats').select('comment_id,like_count').in('comment_id', commentIds),
    likedCommentsAmong(commentIds),
  ])
  const likes = new Map(
    ((stats.error ? [] : (stats.data ?? [])) as { comment_id: string; like_count: number }[]).map(s => [
      s.comment_id,
      s.like_count,
    ]),
  )

  return { comments: rows.map(r => toComment(r, who, likes, liked)), totalRoots }
}

/** 이 댓글들 가운데 내가 좋아요 누른 것. 로그인 전이면 묻지 않는다 */
async function likedCommentsAmong(ids: string[]): Promise<Set<string>> {
  // 세션은 기기에 적어 둔 것을 읽는다. 네트워크를 타지 않는다
  const { data } = await supabase.auth.getSession()
  const me = data.session?.user.id
  if (!me || ids.length === 0) return new Set()
  const { data: rows, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', me)
    .in('comment_id', ids)
  if (error) return new Set()
  return new Set(((rows ?? []) as { comment_id: string }[]).map(r => r.comment_id))
}

/** 댓글 좋아요. 볼 수 없는 댓글이면 정책이 막는다(0023) */
export async function likeComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId })
  if (error) throw error
}

export async function unlikeComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function addComment(
  subject: CommentSubject,
  author: string,
  body: string,
  parentId: string | null,
): Promise<void> {
  const { error } = await supabase.from('comments').insert({
    subject_type: subject.type,
    subject_id: subject.id,
    author,
    body: body.trim(),
    parent_id: parentId,
  })
  if (error) throw error
}

/**
 * 지우기.
 *
 * 행을 지우지 않고 표시만 남긴다 — 답글이 달린 댓글을 통째로 지우면 남이 쓴 답글까지
 * 사라진다. 본인과 관리자만 통과하는 것은 RLS 가 막는다.
 */
export async function removeComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** 신고. 같은 사람이 같은 글을 여러 번 눌러도 한 건이다 */
/**
 * 신고를 넣는다.
 *
 * 같은 사람이 같은 글을 다시 신고하면 **조용히 넘긴다**(ON CONFLICT DO NOTHING).
 * 덮어쓰기로 두면 안 된다 — 표에는 insert 정책만 열려 있고 update 는 닫혀 있어서,
 * 두 번째 신고가 update 로 바뀌는 순간 정책에 막혀 실패한다. 처음 신고한 사유가
 * 남는 것이 맞기도 하다.
 */
export async function reportComment(id: string, reporter: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('comment_reports')
    .upsert(
      { comment_id: id, reporter, reason },
      { onConflict: 'comment_id,reporter', ignoreDuplicates: true },
    )
  if (error) throw error
}

/**
 * 내가 관리자인가.
 *
 * 명단은 관리자만 읽는다(0012). 그래서 "한 줄이라도 읽혔다" 는 것 자체가 답이다 —
 * 따로 물어볼 것이 없다. 관리자가 아니면 정책이 빈 목록을 준다.
 */
export async function amIAdmin(): Promise<boolean> {
  const { data, error } = await supabase.from('admins').select('user_id').limit(1)
  if (error) return false
  return (data ?? []).length > 0
}

/** 내가 차단한 사람들. 그 사람들 댓글은 목록에서 걸러 낸다 */
export async function listBlocked(): Promise<string[]> {
  const { data, error } = await supabase.from('user_blocks').select('blocked')
  if (error) throw error
  return (data ?? []).map(r => (r as { blocked: string }).blocked)
}

export async function blockUser(blocker: string, blocked: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').upsert({ blocker, blocked })
  if (error) throw error
}

/** 차단 풀기. 자리만 남겨 두고 가려 둔 글이 다시 읽힌다 */
export async function unblockUser(blocked: string): Promise<void> {
  const { error } = await supabase.from('user_blocks').delete().eq('blocked', blocked)
  if (error) throw error
}

/**
 * 관리자가 댓글을 내린다. 서버 함수로 한다(0025) — 관리자도 남의 나만 보기 글에 달린 댓글은 읽기
 * 정책에 걸려, update 로 지우면 조용히 0 행이 된다. 관리자가 아니면 함수가 거절한다.
 */
export async function adminDeleteComment(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_comment', { p_id: id })
  if (error) throw error
}

/** 차단한 사람 한 명. 차단 목록 화면이 쓴다 */
export interface BlockedUser {
  id: string
  /** 프로필을 아직 안 만든 사람이면 null */
  handle: string | null
  avatarUrl: string | null
}

/**
 * 차단한 사람들을 이름과 함께. 차단 표는 내 것만 읽힌다(0011). 프로필을 못 읽은 사람도 빠뜨리지 않는다 —
 * 목록에서 사라지면 풀 길도 사라진다.
 */
export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const ids = await listBlocked()
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('profiles').select('id,handle,avatar_url').in('id', ids)
  const who = new Map(
    (error ? [] : ((data ?? []) as { id: string; handle: string; avatar_url: string | null }[])).map(p => [
      p.id,
      p,
    ]),
  )
  return ids.map(id => ({
    id,
    handle: who.get(id)?.handle ?? null,
    avatarUrl: who.get(id)?.avatar_url ?? null,
  }))
}
