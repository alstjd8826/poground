import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { CardMakerScreen } from '@/screens/CardMakerScreen'
import type { SaveAction } from '@/components/foundation/HeaderAction'

/**
 * 카드 자체는 제스처와 스키아로 그려서 jest 에서는 뜨지 않는다
 * (Reanimated.useEvent 가 목에 없다). 여기서 볼 것은 화면 구성이므로 자리만 둔다.
 */
jest.mock('@/components/club/PlayerCard', () => {
  const React = require('react')
  return {
    ...jest.requireActual('@/components/club/PlayerCard'),
    PlayerCard: () => React.createElement('PlayerCardStub'),
  }
})

/**
 * 카드 만들기는 "위에 미리보기, 아래에 갈래 탭 + 가로 스트립" 이다.
 *
 * 꾸미기 화면의 통상 구조를 따랐다. 고르는 즉시 카드가 바뀌는 것을 보는 일이 핵심이라,
 * 고를 것을 세로로 쌓아 카드를 밀어내거나 시트로 덮지 않는다.
 *
 * 여기서 지키려는 것은 셋이다.
 *   갈래를 바꿔도 카드는 그대로 보인다
 *   항목은 그 갈래의 스트립에만 있다 — 다른 갈래 것이 같이 보이지 않는다
 *   스트립에 안 들어가는 둘(글자 입력·색상판)만 시트로 연다
 */

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

async function open(ui: React.ReactElement) {
  const result = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="home">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  )
  // useFanCards 가 AsyncStorage 에서 비동기로 읽는다. 그 전에는 빈 화면이다
  await result.findByText('사진 고르기')
  return result
}

/** 키보드 위 바의 단추를 누른다 */
function pressBar(label: string) {
  fireEvent.press(screen.getByText(label))
}

/** 갈래 탭을 이름으로 누른다 */
function goTab(label: string) {
  fireEvent.press(screen.getByText(label))
}

/**
 * 저장을 띄우고 누를 것을 받아 둔다.
 *
 * 저장 단추는 헤더 오른쪽에 걸리는데 헤더를 그리는 것은 내비게이터라, 화면만 띄운
 * 여기에는 누를 단추가 없다. 화면이 올려 주는 것을 그대로 잡아서 누른다 —
 * 헤더에 걸리는 것과 같은 것이다.
 */
async function openWithSave(props: Partial<React.ComponentProps<typeof CardMakerScreen>> = {}) {
  const held: { action?: SaveAction } = {}
  await open(<CardMakerScreen {...props} onSaveAction={a => (held.action = a)} />)
  expect(held.action).toBeDefined()
  return async () => {
    await act(async () => {
      await held.action!.onPress()
    })
  }
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('갈래 탭과 스트립', () => {
  it('처음에는 사진 갈래가 열려 있다', async () => {
    await open(<CardMakerScreen />)
    expect(screen.getByText('사진 고르기')).toBeTruthy()
    // 다른 갈래의 항목은 같이 보이지 않는다
    expect(screen.queryByText('동심원')).toBeNull()
  })

  it('무늬 갈래에는 무늬만 깔린다', async () => {
    await open(<CardMakerScreen />)
    goTab('무늬')

    expect(screen.getByText('동심원')).toBeTruthy()
    expect(screen.getByText('격자')).toBeTruthy()
    // 홀로 항목은 제 갈래에 있다
    expect(screen.queryByText('굴절')).toBeNull()
    expect(screen.queryByText('사진 고르기')).toBeNull()
  })

  it('홀로 갈래에는 효과만 깔린다', async () => {
    await open(<CardMakerScreen />)
    goTab('홀로')

    expect(screen.getByText('굴절')).toBeTruthy()
    expect(screen.getByText('반짝이')).toBeTruthy()
    expect(screen.queryByText('동심원')).toBeNull()
  })

  it('정보 갈래는 지금 값을 알약에 적어 둔다', async () => {
    await open(<CardMakerScreen />)
    goTab('정보')

    // 칩에는 값만 적는다. 카드에 그 값이 그대로 보이므로 이름표까지 붙이면 같은 말이 두 번이다
    expect(screen.getByText('김포항')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    expect(screen.getByText('FAN')).toBeTruthy()
    // 다만 화면 읽기에는 무엇의 값인지 말해 준다
    expect(screen.getByLabelText('등번호 7')).toBeTruthy()
  })

  /** 카드가 계속 보이는 것이 이 구조를 고른 이유다 */
  it('갈래를 바꿔도 카드는 그대로 보인다', async () => {
    const { toJSON } = await open(<CardMakerScreen />)
    const has = () => JSON.stringify(toJSON()).includes('PlayerCardStub')

    expect(has()).toBe(true)
    goTab('무늬')
    expect(has()).toBe(true)
    goTab('색')
    expect(has()).toBe(true)
  })
})

describe('스트립에 안 들어가는 것만 따로 연다', () => {
  /**
   * 글자 입력은 키보드 바로 위에 **한 칸만** 띄운다.
   *
   * 칸 셋을 담은 시트를 띄우면 어느 칸을 누르든 키보드가 시트를 통째로 밀어 올려서,
   * 고치는 중인 칸의 자리가 매번 달라지고 카드도 그만큼 가려진다.
   */
  it('누른 칸 하나만 연다', async () => {
    await open(<CardMakerScreen />)
    goTab('정보')
    expect(screen.queryByLabelText('이름')).toBeNull()

    fireEvent.press(screen.getByLabelText('이름 김포항'))

    expect(screen.getByLabelText('이름')).toBeTruthy()
    // 다른 칸은 같이 열리지 않는다
    expect(screen.queryByLabelText('등번호')).toBeNull()
  })

  /**
   * 넘어가는 순서는 이름 → 한 줄 → 등번호다. 숫자 칸을 맨 끝에 두어야 사슬이 안 끊긴다 —
   * 가운데 두면 거기서 넘길 단추가 없어 더 갈 수 없는 자리에 떨어진다.
   */
  it('다음 단추가 숫자 칸까지 이어진다', async () => {
    await open(<CardMakerScreen />)
    goTab('정보')
    fireEvent.press(screen.getByLabelText('이름 김포항'))

    pressBar('다음')
    expect(screen.getByLabelText('한 줄')).toBeTruthy()

    pressBar('다음')
    expect(screen.getByLabelText('등번호')).toBeTruthy()

    // 맨 끝이라 넘길 곳이 없다. 단추가 "완료" 로 바뀌고 누르면 닫힌다
    expect(screen.queryByText('다음')).toBeNull()
    pressBar('완료')
    expect(screen.queryByLabelText('등번호')).toBeNull()
  })

  /** 숫자 칸은 사슬의 맨 끝이라 넘길 곳이 없다. 단추 글자가 "완료" 로 바뀐다 */
  it('숫자 칸의 단추는 완료다', async () => {
    await open(<CardMakerScreen />)
    goTab('정보')
    fireEvent.press(screen.getByLabelText('등번호 7'))

    expect(screen.getByLabelText('등번호')).toBeTruthy()
    expect(screen.queryByText('다음')).toBeNull()

    pressBar('완료')
    expect(screen.queryByLabelText('등번호')).toBeNull()
  })

  /**
   * 시트의 마치는 단추는 **위 오른쪽**에 있다.
   *
   * 애플 HIG 가 iOS 에서 정한 자리다. 전에는 아래에 큰 단추로 뒀는데, 내용이 길면
   * 스크롤 밖으로 밀리고 자리도 규격과 어긋난다.
   */
  it('시트의 완료는 아래가 아니라 위에 있다', async () => {
    await open(<CardMakerScreen />)
    goTab('색')
    fireEvent.press(screen.getByText('직접 고르기'))

    // 아래 큰 단추였을 때는 이름이 곧 글자였다. 이제 위 줄의 글자 단추다
    const done = screen.getByLabelText('완료')
    fireEvent.press(done)
    expect(screen.queryByText('색 고르기')).toBeNull()
  })

  /** 색상판은 정사각형이라 가로 스트립에 안 들어간다 */
  it('색은 스트립에서 고르고, 색상판만 시트로 연다', async () => {
    await open(<CardMakerScreen />)
    goTab('색')

    // 자주 쓰는 색은 스트립에 그대로 있다
    expect(screen.getByLabelText('색 #FB342E')).toBeTruthy()

    fireEvent.press(screen.getByText('직접 고르기'))
    expect(screen.getByText('색 고르기')).toBeTruthy()
    // 색 코드는 시트에 없다. 키보드 바로 따로 연다
    expect(screen.queryByLabelText('색 코드')).toBeNull()
  })
})

describe('저장', () => {
  /**
   * 저장은 헤더 오른쪽으로 갔다. 아래에 두면 고를 것이 깔리는 스트립 바로 밑에 붙어,
   * 고르는 일과 끝내는 일이 한 자리에서 섞인다.
   */
  it('저장 단추는 화면 안에 없고 헤더로 올라간다', async () => {
    const held: { action?: SaveAction } = {}
    await open(<CardMakerScreen onSaveAction={a => (held.action = a)} />)

    expect(screen.queryByLabelText('저장')).toBeNull()
    expect(held.action?.onPress).toBeInstanceOf(Function)
    expect(held.action?.busy).toBe(false)
  })

  /**
   * 만드는 것은 로그인 없이 되지만 **저장은 로그인이 필요하다.**
   * 공들여 만든 카드를 로그인 때문에 버리게 하지 않는 것이 여기서 지킬 것이다.
   */
  it('로그인 전에 저장하면 로그인을 청한다', async () => {
    const onSaved = jest.fn()
    const press = await openWithSave({ onSaved })

    await press()

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())
    const [title] = (Alert.alert as jest.Mock).mock.calls.at(-1)!
    expect(title).toContain('로그인')
    expect(onSaved).not.toHaveBeenCalled()
  })

  /**
   * 얼럿 단추에는 카카오 규격 버튼을 넣을 수 없다(색도 이미지도 못 넣는다).
   * 그래서 중립적인 "로그인" 만 두고 규격대로 된 버튼이 있는 화면으로 보낸다.
   */
  it('로그인을 고르면 로그인 화면으로 보낸다', async () => {
    const onRequireLogin = jest.fn()
    const press = await openWithSave({ onRequireLogin })

    await press()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1)!
    const login = (buttons as Array<{ text: string; onPress?: () => void }>).find(b => b.text === '로그인')
    expect(login).toBeDefined()
    login!.onPress?.()

    expect(onRequireLogin).toHaveBeenCalled()
  })

  it('나중에 를 고르면 화면만 닫는다', async () => {
    const onSaved = jest.fn()
    const press = await openWithSave({ onSaved })

    await press()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled())

    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1)!
    const later = (buttons as Array<{ text: string; onPress?: () => void }>).find(b => b.text === '나중에')
    expect(later).toBeDefined()
    later!.onPress?.()

    expect(onSaved).toHaveBeenCalled()
  })
})

/**
 * 색 코드는 시트 안에서 넘겨받는다.
 *
 * 입력칸을 시트에 그대로 두면 키보드가 시트를 통째로 밀어 올린다 — 정작 시트의 주인공인
 * 색상판과 견본은 키보드가 필요 없는데 그것들까지 출렁였다. 그래서 시트를 닫고 키보드
 * 바를 띄운다. 애플 지침이 말하는 "먼저 것을 닫고, 필요하면 다시 띄워라" 다.
 */
describe('색 코드', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('시트를 닫고 키보드 바를 띄웠다가, 닫으면 시트로 돌아온다', async () => {
    await open(<CardMakerScreen />)
    goTab('색')
    fireEvent.press(screen.getByText('직접 고르기'))
    expect(screen.getByText('색 고르기')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('색 코드 입력 열기'))

    // 시트는 닫히고 바만 남는다. 둘을 겹쳐 띄우지 않는다
    expect(screen.getByLabelText('색 코드')).toBeTruthy()
    expect(screen.queryByText('색 고르기')).toBeNull()

    fireEvent.press(screen.getByLabelText('완료'))
    expect(screen.queryByLabelText('색 코드')).toBeNull()
    // 곧바로는 안 돌아온다. 걷히는 동안 띄우면 iOS 가 삼킨다
    expect(screen.queryByText('색 고르기')).toBeNull()

    /*
      바가 사라지고 나서 시트가 돌아온다. 곧바로 띄우면 iOS 가 앞의 Modal 을 걷는
      중이라 시트를 삼킨다 — 그 기다림을 여기서도 흘려 준다.
    */
    await act(async () => {
      jest.advanceTimersByTime(400)
    })
    expect(screen.getByText('색 고르기')).toBeTruthy()
  })
})
