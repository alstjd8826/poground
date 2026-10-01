import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PostComposerScreen } from '@/screens/PostComposerScreen'
import type { SaveAction } from '@/components/foundation/HeaderAction'
import type { Post } from '@/models/community'
import { matchTag } from '@/models/postTags'
import { mockMatchFinished } from '@/utils/fixtures'

const mockSave = jest.fn()
let mockSession: { user: { id: string } } | null = { user: { id: 'me' } }
const mockPostState: { post: Post | null | undefined; blocked: boolean; query: { isPending: boolean } } = {
  post: undefined,
  blocked: false,
  query: { isPending: false },
}
jest.mock('@/hooks/auth/useAuth', () => ({ useAuth: () => ({ session: mockSession }) }))
jest.mock('@/hooks/community/useCommunity', () => ({
  useSavePost: () => ({ mutateAsync: mockSave, isPending: false }),
  usePost: () => mockPostState,
  usePhotoAt: () => null,
}))
const mockScheduled = {
  ...mockMatchFinished,
  id: 999,
  status: 'scheduled' as const,
  kickoffAtMs: Date.parse('2099-01-01T00:00:00Z'),
}
jest.mock('@/hooks/query/useKleague', () => ({
  useMatches: () => ({ data: [mockMatchFinished, mockScheduled] }),
}))
const mockPickMany = jest.fn()
jest.mock('@/utils/pickPhoto', () => ({
  pickManyFromLibrary: (n: number) => mockPickMany(n),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }))
jest.mock('@/repositories/profile/search', () => ({
  MENTION_SUGGEST_LIMIT: 5,
  searchHandles: async () => [{ id: 'u1', handle: 'steel', avatarUrl: null }],
}))

let action: SaveAction | null = null
const wrap = (ui: React.ReactElement) => render(<ThemeProvider initialPreference="home">{ui}</ThemeProvider>)
const compose = (props: Partial<React.ComponentProps<typeof PostComposerScreen>> = {}) =>
  wrap(<PostComposerScreen onSaveAction={a => (action = a)} {...props} />)

beforeEach(() => {
  action = null
  mockSession = { user: { id: 'me' } }
  mockSave.mockReset().mockImplementation(async ({ postId }: { postId: string }) => ({
    id: postId,
    updatedAt: 't',
    uploaded: [],
  }))
  mockPickMany.mockReset()
  mockPostState.post = undefined
  jest.restoreAllMocks()
})

describe('새 글', () => {
  it('본문이 비면 올리기가 잠기고 쓰면 풀린다', () => {
    compose()
    expect(action?.disabled).toBe(true)
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '직관 다녀왔다')
    expect(action?.disabled).toBe(false)
  })

  it('남은 글자 수를 보여 주고 1,000자에서 막는다', () => {
    compose()
    const input = screen.getByPlaceholderText('경기장 이야기를 남겨 보세요')
    expect(input.props.maxLength).toBe(1000)
    fireEvent.changeText(input, '안녕')
    expect(screen.getByText('2/1000')).toBeTruthy()
  })

  it('앨범은 남은 자리만큼만 묻고, 4장이 차면 더 넣는 단추가 없다', async () => {
    mockPickMany.mockResolvedValueOnce(['a', 'b', 'c'].map(uri => ({ uri, assetId: uri })))
    compose()
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(mockPickMany).toHaveBeenLastCalledWith(4)
    mockPickMany.mockResolvedValueOnce([{ uri: 'd', assetId: 'd' }])
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(mockPickMany).toHaveBeenLastCalledWith(1)
    expect(screen.queryByLabelText('앨범에서 고르기')).toBeNull()
  })

  it('사진 넣는 칸은 + 로 보인다', () => {
    compose()
    expect(within(screen.getByLabelText('앨범에서 고르기')).getByText('+')).toBeTruthy()
    expect(screen.queryByText('앨범')).toBeNull()
  })

  it('사진 권한이 없으면 안내한다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockPickMany.mockResolvedValueOnce('denied')
    compose()
    await act(async () => fireEvent.press(screen.getByLabelText('앨범에서 고르기')))
    expect(alert).toHaveBeenCalledWith('사진 접근이 필요합니다', expect.any(String))
  })

  /** 사진은 앨범에서만 넣는다 (2026-09-29) */
  it('카메라로 찍는 단추가 없다', () => {
    compose()
    expect(screen.queryByLabelText('사진 찍기')).toBeNull()
    expect(screen.queryByLabelText('직관 글로 쓰기')).toBeNull()
  })

  /** 직관 글은 본문의 #직관, 경기는 경기 태그로 가른다 (2026-09-29) */
  it('끝난 경기만 고를 수 있고, 고르면 본문에 #직관 과 경기 태그가 들어간다', () => {
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '좋았다')
    expect(screen.queryByText(matchTag(mockScheduled))).toBeNull()
    fireEvent.press(screen.getByText(matchTag(mockMatchFinished)))
    expect(screen.getByDisplayValue(`좋았다\n#직관 ${matchTag(mockMatchFinished)}`)).toBeTruthy()
    expect(screen.getByLabelText(`${matchTag(mockMatchFinished)}, 고름`)).toBeTruthy()
  })

  it('고른 경기를 다시 누르면 경기 태그만 빠진다', () => {
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '좋았다')
    fireEvent.press(screen.getByText(matchTag(mockMatchFinished)))
    fireEvent.press(screen.getByText(matchTag(mockMatchFinished)))
    expect(screen.getByDisplayValue('좋았다\n#직관')).toBeTruthy()
  })

  it('본문의 경기 태그로 찾은 경기를 저장에 넘긴다', async () => {
    compose()
    fireEvent.changeText(
      screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'),
      `#직관 ${matchTag(mockMatchFinished)} 좋았다`,
    )
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ match: { year: 2026, leagueId: 1, gameId: mockMatchFinished.id } }),
    )
  })

  it('#직관 만 있고 경기 태그가 없으면 경기 없이 저장한다', async () => {
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '#직관 좋았다')
    expect(action?.disabled).toBe(false)
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ match: null }))
  })

  /** 직관 예정 경기에서도 글을 쓴다. 아직 안 한 경기는 들어온 그 경기만 고를 수 있다 */
  it('직관 예정 경기에서 들어오면 그 경기 태그가 들어가 있다', () => {
    compose({ match: { year: 2026, leagueId: 1, gameId: mockScheduled.id } })
    expect(screen.getByDisplayValue(`#직관 ${matchTag(mockScheduled)}`)).toBeTruthy()
    expect(screen.getByLabelText(`${matchTag(mockScheduled)}, 고름`)).toBeTruthy()
  })

  /** 태그만 있으면 누를 때 태그를 아래로 내리고 맨 앞에서 쓰게 한다 (2026-09-29) */
  it('태그뿐인 본문을 누르면 태그가 둘째 줄로 가고 커서가 맨 앞에 선다', async () => {
    compose({ match: { year: 2026, leagueId: 1, gameId: mockMatchFinished.id } })
    const input = screen.getByPlaceholderText('경기장 이야기를 남겨 보세요')
    fireEvent(input, 'focus')
    await waitFor(() => expect(input.props.value).toBe(`\n#직관 ${matchTag(mockMatchFinished)}`))
    expect(input.props.selection).toEqual({ start: 0, end: 0 })
  })

  it('경기 상세에서 들어오면 본문에 그 경기 태그가 들어가 있다', () => {
    compose({ match: { year: 2026, leagueId: 1, gameId: mockMatchFinished.id } })
    expect(screen.getByDisplayValue(`#직관 ${matchTag(mockMatchFinished)}`)).toBeTruthy()
  })

  it('나만 보기를 켜고 올리면 그 설정으로 저장하고 끝을 알린다', async () => {
    const onDone = jest.fn()
    compose({ onDone })
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '혼자 볼 글')
    fireEvent(screen.getByLabelText('나만 보기'), 'valueChange', true)
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith({
      postId: 'new-id',
      previousPaths: [],
      match: null,
      draft: expect.objectContaining({ body: '혼자 볼 글', visibility: 'private' }),
    })
    expect(onDone).toHaveBeenCalledWith('new-id', true)
  })

  /** 헤더 버튼의 busy 는 다시 그린 뒤에야 걸린다. 그 사이 두 번 누르면 글이 두 개 올라갔다 */
  it('올리는 중에 다시 눌러도 한 번만 올린다', async () => {
    let finish: (v: unknown) => void = () => {}
    mockSave.mockImplementation(() => new Promise(resolve => (finish = resolve)))
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '한 번만')
    const press = action!.onPress
    await act(async () => {
      press()
      press()
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
    await act(async () => finish({ id: 'new-id', updatedAt: 't', uploaded: [] }))
  })

  it('실패한 뒤에는 다시 올릴 수 있다', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockSave.mockRejectedValueOnce(new Error('network'))
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '다시')
    await act(async () => action!.onPress())
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledTimes(2)
  })

  it('올리기가 실패하면 알리고 초안을 그대로 둔다', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mockSave.mockRejectedValue(new Error('network'))
    const onDone = jest.fn()
    compose({ onDone })
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '남아야 할 글')
    await act(async () => action!.onPress())
    expect(alert).toHaveBeenCalledWith('올리지 못했습니다', expect.stringContaining('다시 올려'))
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('남아야 할 글')).toBeTruthy()
  })
})

/** 글쓰기 본문에서도 @ 를 치면 아이디 후보를 띄운다 (2026-09-29) */
describe('언급 후보', () => {
  it('@글자 를 치면 후보가 뜨고, 고르면 @아이디 로 바뀐다', async () => {
    compose()
    fireEvent.changeText(screen.getByPlaceholderText('경기장 이야기를 남겨 보세요'), '같이 간 @st')
    fireEvent.press(await screen.findByLabelText('@steel 고르기'))
    expect(await screen.findByDisplayValue('같이 간 @steel')).toBeTruthy()
  })
})

describe('고치기', () => {
  const mine = {
    id: 'p1',
    authorId: 'me',
    body: '예전 글',
    visibility: 'public',
    match: null,
    photos: [{ position: 0, path: 'me/p1/a' }],
  } as unknown as Post

  it('글을 불러와 채우고, 저장하면 옛 사진 경로를 함께 넘긴다', async () => {
    mockPostState.post = mine
    const onDone = jest.fn()
    compose({ postId: 'p1', onDone })
    await waitFor(() => expect(screen.getByDisplayValue('예전 글')).toBeTruthy())
    await act(async () => action!.onPress())
    expect(mockSave).toHaveBeenCalledWith({
      postId: 'p1',
      previousPaths: ['me/p1/a'],
      match: null,
      draft: expect.objectContaining({ photos: [{ kind: 'remote', key: 'me/p1/a', path: 'me/p1/a' }] }),
    })
    expect(onDone).toHaveBeenCalledWith('p1', false)
  })

  it('내 글이 아니면 고칠 수 없다', () => {
    mockPostState.post = { ...mine, authorId: 'someone' } as Post
    compose({ postId: 'p1' })
    expect(screen.getByText('내 글만 고칠 수 있습니다')).toBeTruthy()
    expect(action?.disabled ?? true).toBe(true)
  })

  it('볼 수 없는 글이면 안내한다', () => {
    mockPostState.post = null
    compose({ postId: 'p1' })
    expect(screen.getByText('볼 수 없는 글입니다')).toBeTruthy()
  })
})
