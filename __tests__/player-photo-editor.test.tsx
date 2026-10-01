import React from 'react'
import { Alert } from 'react-native'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { PlayerPhotoEditor } from '@/components/club/PlayerPhotoEditor'

const mockActions = { signedIn: true, put: jest.fn(), remove: jest.fn() }
jest.mock('@/hooks/playerPhoto/usePlayerPhotos', () => ({
  usePlayerPhotoActions: () => mockActions,
}))

const mockPick = jest.fn()
const mockCut = jest.fn()
jest.mock('@/utils/pickPhoto', () => ({
  pickFromLibrary: () => mockPick(),
  cutOut: (uri: string) => mockCut(uri),
}))

function open(props: Partial<React.ComponentProps<typeof PlayerPhotoEditor>> = {}) {
  const onPreview = jest.fn()
  const onRequireLogin = jest.fn()
  render(
    <ThemeProvider initialPreference="home">
      <PlayerPhotoEditor
        playerId="20060066"
        hasPhoto={false}
        onPreview={onPreview}
        onRequireLogin={onRequireLogin}
        {...props}
      />
    </ThemeProvider>,
  )
  return { onPreview, onRequireLogin }
}

beforeEach(() => {
  mockActions.signedIn = true
  mockActions.put.mockReset().mockResolvedValue(undefined)
  mockActions.remove.mockReset().mockResolvedValue(undefined)
  mockPick.mockReset().mockResolvedValue('file:///raw.jpg')
  mockCut.mockReset().mockResolvedValue('file:///cut.png')
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

// 같은 스파이를 다시 걸면 앞 테스트의 호출 기록이 남는다. 매번 되돌린다
afterEach(() => jest.restoreAllMocks())

describe('선수 사진 편집기', () => {
  it('사진이 없으면 넣기만 보인다', () => {
    open()
    expect(screen.getByText('사진 넣기')).toBeTruthy()
    expect(screen.queryByText('치우기')).toBeNull()
  })

  it('사진이 있으면 바꾸기와 치우기가 보인다', () => {
    open({ hasPhoto: true })
    expect(screen.getByText('바꾸기')).toBeTruthy()
    expect(screen.getByText('치우기')).toBeTruthy()
  })

  /** 신고·차단과 같은 흐름. 앨범부터 열면 고르고 나서 막힌다 */
  it('로그인 전이면 로그인부터 청하고 앨범을 열지 않는다', () => {
    mockActions.signedIn = false
    const { onRequireLogin } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    expect(onRequireLogin).toHaveBeenCalled()
    expect(mockPick).not.toHaveBeenCalled()
  })

  it('고르면 누끼를 바로 보여 주고 올린다', async () => {
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalledWith('file:///cut.png'))
    expect(onPreview).toHaveBeenCalledWith('file:///cut.png')
  })

  it('누끼를 못 따면 원본을 올리고 전환은 없다', async () => {
    mockCut.mockResolvedValue(null)
    open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalledWith('file:///raw.jpg'))
    expect(screen.queryByText('원본으로')).toBeNull()
  })

  it('방금 고른 사진은 원본으로 되돌려 다시 올릴 수 있다', async () => {
    open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => screen.getByText('원본으로'))
    fireEvent.press(screen.getByText('원본으로'))
    await waitFor(() => expect(mockActions.put).toHaveBeenLastCalledWith('file:///raw.jpg'))
    expect(screen.getByText('누끼로')).toBeTruthy()
  })

  /** 넣은 줄 알았는데 다음에 보니 없는 것이 제일 나쁘다 */
  it('올리기가 실패하면 알리고 미리보기를 거둔다', async () => {
    mockActions.put.mockRejectedValue(new Error('network'))
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('사진을 올리지 못했습니다', 'network'))
    expect(onPreview).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByText('사진 넣기')).toBeTruthy()
  })

  /**
   * 닫고 다른 선수를 연 뒤 앞 업로드가 실패로 끝나도 그 카드를 건드리면 안 된다.
   * 오버레이는 닫힐 때 미리보기를 거두는데, 늦게 온 실패가 새 선수 카드의 미리보기를 또
   * 거두거나 엉뚱한 알림을 띄우면 안 된다.
   */
  it('사라진 뒤 실패한 업로드는 미리보기도 알림도 건드리지 않는다', async () => {
    let fail: (e: Error) => void = () => {}
    mockActions.put.mockReturnValue(new Promise<void>((_resolve, reject) => (fail = reject)))
    const { onPreview } = open()
    fireEvent.press(screen.getByText('사진 넣기'))
    await waitFor(() => expect(mockActions.put).toHaveBeenCalled())
    screen.unmount()
    const calls = onPreview.mock.calls.length
    fail(new Error('network'))
    await new Promise(resolve => setImmediate(resolve))
    expect(onPreview.mock.calls.length).toBe(calls)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('치우기는 확인을 받는다', () => {
    open({ hasPhoto: true })
    fireEvent.press(screen.getByText('치우기'))
    expect(Alert.alert).toHaveBeenCalledWith('사진을 치울까요?', undefined, expect.any(Array))
    expect(mockActions.remove).not.toHaveBeenCalled()
  })
})
