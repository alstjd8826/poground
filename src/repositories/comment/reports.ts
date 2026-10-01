import { supabase } from '@/repositories/remote/supabase'
import type { CommentSubject } from '@/repositories/comment/remote'

/** 한 번에 받아 오는 신고 수 */
export const REPORT_PAGE = 30

interface Row {
  kind: string
  target_id: string
  report_count: number
  last_reported_at: string
  resolved: boolean
  reasons: string[] | null
  subject_type: string
  subject_id: string
  body: string
  author: string
  deleted: boolean
}

/**
 * 신고 한 건.
 *
 * 단위는 신고가 아니라 **신고당한 대상**(댓글 하나, 게시글 하나)이다. 한 대상에 열 명이 신고해도
 * 판단할 일은 하나다.
 */
export interface Report {
  /** 신고당한 것이 댓글인지 게시글인지 (0025) */
  kind: 'comment' | 'post'
  /** 댓글 id 또는 게시글 id */
  targetId: string
  /** 몇 명이 신고했는지 */
  count: number
  lastReportedAt: string
  resolved: boolean
  /** 사람들이 고른 사유. 빈 것은 서버에서 걸러져 온다 */
  reasons: string[]
  /** 눌러서 갈 곳. 댓글은 달린 곳, 게시글은 그 글 */
  subject: CommentSubject
  body: string
  authorId: string
  /** 글쓴이 아이디. 못 읽으면 비어 있다 */
  handle: string | null
  /** 이미 지워진 것인지. 지워졌으면 더 할 일이 없다 */
  deleted: boolean
}

const isSubjectType = (v: string): v is CommentSubject['type'] =>
  v === 'match' || v === 'player' || v === 'news' || v === 'post'

/**
 * 신고함 한 쪽. 관리자 전용 서버 함수(0025)가 댓글·게시글 신고를 최신순으로 준다 — 뷰로 두면 관리자도
 * 글 읽기 정책에 걸려 나만 보기로 바뀐 글의 신고가 사라졌다. 관리자가 아니면 함수가 거절한다.
 */
export async function listReports(page: number, onlyOpen: boolean): Promise<Report[]> {
  const { data, error } = await supabase.rpc('report_inbox_page', {
    p_only_open: onlyOpen,
    p_offset: page * REPORT_PAGE,
    p_limit: REPORT_PAGE,
  })
  if (error) throw error

  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return []

  const ids = [...new Set(rows.map(r => r.author))]
  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id,handle')
    .in('id', ids)
  // 이름을 못 읽어도 신고는 보여 준다. 처리해야 할 일이 이름 때문에 가려지면 안 된다
  const who = new Map(
    (peopleError ? [] : ((people ?? []) as { id: string; handle: string | null }[])).map(p => [
      p.id,
      p.handle,
    ]),
  )

  return rows.map(r => ({
    kind: r.kind === 'post' ? 'post' : 'comment',
    targetId: r.target_id,
    count: r.report_count,
    lastReportedAt: r.last_reported_at,
    resolved: r.resolved,
    reasons: r.reasons ?? [],
    // 함수가 주는 값이라 우리가 아는 갈래여야 하지만, 아니면 경기로 떨어뜨린다
    subject: {
      type: isSubjectType(r.subject_type) ? r.subject_type : 'match',
      id: r.subject_id,
    },
    body: r.body,
    authorId: r.author,
    handle: who.get(r.author) ?? null,
    deleted: r.deleted,
  }))
}

/** 처리했다고 표시한다. 권한 확인은 서버 함수가 한다 */
export async function resolveReport(report: Pick<Report, 'kind' | 'targetId'>): Promise<void> {
  const { error } =
    report.kind === 'post'
      ? await supabase.rpc('resolve_post_report', { p_post_id: report.targetId })
      : await supabase.rpc('resolve_report', { p_comment_id: report.targetId })
  if (error) throw error
}
