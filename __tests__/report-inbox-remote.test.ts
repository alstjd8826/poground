import { listReports, resolveReport } from '@/repositories/comment/reports'

/** 신고함은 관리자 함수(0025)가 댓글·게시글 신고를 한 목록으로 준다 (3단계, 2026-09-29) */

const mockRpc = jest.fn()
jest.mock('@/repositories/remote/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({ in: async () => ({ data: [{ id: 'a', handle: 'aa' }], error: null }) }),
    }),
  },
}))

const row = (over: Record<string, unknown>) => ({
  kind: 'comment',
  target_id: 'c1',
  report_count: 1,
  last_reported_at: 't',
  resolved: false,
  reasons: ['욕설'],
  subject_type: 'match',
  subject_id: '180',
  body: '본문',
  author: 'a',
  deleted: false,
  ...over,
})

beforeEach(() => mockRpc.mockReset())

it('신고함 함수를 부르고 댓글·게시글 두 갈래를 옮긴다', async () => {
  mockRpc.mockResolvedValue({
    data: [row({ kind: 'post', target_id: 'p1', subject_type: 'post', subject_id: 'p1' }), row({})],
    error: null,
  })
  const reports = await listReports(0, true)
  expect(mockRpc).toHaveBeenCalledWith('report_inbox_page', { p_only_open: true, p_offset: 0, p_limit: 30 })
  expect(reports.map(r => [r.kind, r.targetId, r.subject.type, r.handle])).toEqual([
    ['post', 'p1', 'post', 'aa'],
    ['comment', 'c1', 'match', 'aa'],
  ])
})

it('게시글 신고 처리는 게시글 처리 함수를, 댓글은 댓글 처리 함수를 부른다', async () => {
  mockRpc.mockResolvedValue({ error: null })
  await resolveReport({ kind: 'post', targetId: 'p1' })
  await resolveReport({ kind: 'comment', targetId: 'c1' })
  expect(mockRpc).toHaveBeenNthCalledWith(1, 'resolve_post_report', { p_post_id: 'p1' })
  expect(mockRpc).toHaveBeenNthCalledWith(2, 'resolve_report', { p_comment_id: 'c1' })
})
