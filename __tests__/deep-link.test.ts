import { commentUrl, navigationRef, openFromUrl, parseCommentUrl } from '@/navigation/deepLink'
import type { CommentSubject } from '@/repositories/comment/remote'

/**
 * 신고 메일이 만드는 주소와 앱이 읽는 모양은 서로 다른 곳(Edge Function 과 앱)에 있다.
 * 한쪽만 고치면 링크가 조용히 아무 일도 안 하므로, 왕복이 맞는지 여기서 잡는다.
 */
describe('댓글 딥링크', () => {
  const cases: CommentSubject[] = [
    { type: 'match', id: '180' },
    { type: 'news', id: '96412' },
    { type: 'player', id: 'K05_2026_12' },
    { type: 'post', id: '6f1c2c1e-0000-4000-8000-000000000001' },
  ]

  it.each(cases)('만든 주소를 그대로 되읽는다: $type', subject => {
    expect(parseCommentUrl(commentUrl(subject))).toEqual(subject)
  })

  /** 서버가 만드는 문자열. 이 모양이 바뀌면 여기서 먼저 깨져야 한다 */
  it('서버가 쓰는 모양과 같다', () => {
    expect(commentUrl({ type: 'news', id: '96412' })).toBe('poground://comment?type=news&id=96412')
  })

  /** 스킴을 poground 로 바꿨다(2026-09-29). 이미 나간 메일의 옛 steelers:// 링크도 연다 */
  it('옛 steelers 스킴 링크도 읽는다', () => {
    expect(parseCommentUrl('steelers://comment?type=post&id=p1')).toEqual({ type: 'post', id: 'p1' })
    expect(parseCommentUrl('poground://comment?type=post&id=p1')).toEqual({ type: 'post', id: 'p1' })
  })

  it('로그인 콜백은 건드리지 않는다', () => {
    expect(parseCommentUrl('steelers://auth/callback?code=abc')).toBeNull()
    expect(parseCommentUrl('poground://auth/callback?code=abc')).toBeNull()
  })

  it('모르는 갈래와 빈 id 는 받지 않는다', () => {
    expect(parseCommentUrl('steelers://comment?type=board&id=1')).toBeNull()
    expect(parseCommentUrl('steelers://comment?type=news')).toBeNull()
    expect(parseCommentUrl('steelers://comment?type=news&id=')).toBeNull()
    expect(parseCommentUrl('steelers://comment')).toBeNull()
  })

  it('id 에 특수문자가 있어도 왕복한다', () => {
    const subject: CommentSubject = { type: 'player', id: 'a b/c&d' }
    expect(parseCommentUrl(commentUrl(subject))).toEqual(subject)
  })
})

/**
 * 링크로 열면 탭의 첫 화면을 밑에 깐다 (2026-09-29). 안 깔면 앱을 링크로 켰을 때 탭 스택이 상세 하나뿐이라
 * 뒤로 갈 곳이 없었다 — 커뮤니티 글을 열면 피드로 나갈 수 없었다.
 */
describe('링크로 화면 열기', () => {
  afterEach(() => jest.restoreAllMocks())

  it('탭 안의 상세를 열되 첫 화면을 밑에 둔다', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(true)
    const navigate = jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {})
    expect(openFromUrl('poground://comment?type=post&id=p1')).toBe(true)
    expect(navigate).toHaveBeenCalledWith('Media', {
      screen: 'Post',
      params: { postId: 'p1' },
      initial: false,
    })
  })

  it('내비게이터가 아직 안 섰으면 열지 않는다', () => {
    jest.spyOn(navigationRef, 'isReady').mockReturnValue(false)
    expect(openFromUrl('poground://comment?type=post&id=p1')).toBe(false)
  })
})
