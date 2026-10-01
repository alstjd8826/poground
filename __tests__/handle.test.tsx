import {
  checkHandle,
  HANDLE_MAX,
  HANDLE_MIN,
  handleProblemMessage,
  isValidHandle,
  normalizeHandle,
  randomHandle,
  RESERVED_HANDLES,
} from '@/utils/handle'

/**
 * 아이디 규칙.
 *
 * 규칙이 DB(0007_profile_handle.sql)와 여기 두 군데에 있다. 한쪽만 고치면 조용히
 * 어긋나서, 앱은 통과시킨 값이 저장될 때 거부당한다. 그래서 여기 테스트는
 * **DB 제약과 같은 것을 재는** 셈이다.
 *
 * DB 쪽 제약:
 *   handle ~ '^[a-z][a-z0-9_]{1,18}[a-z0-9]$'   AND   handle !~ '__'
 */

describe('규칙 검사', () => {
  it('평범한 아이디를 받는다', () => {
    expect(isValidHandle('steel_7k3f')).toBe(true)
    expect(isValidHandle('abc')).toBe(true)
    expect(isValidHandle('a1_b2_c3')).toBe(true)
  })

  it('길이를 지킨다', () => {
    expect(checkHandle('ab')).toBe('short')
    expect(isValidHandle('a'.repeat(HANDLE_MIN))).toBe(true)
    expect(isValidHandle('a'.repeat(HANDLE_MAX))).toBe(true)
    expect(checkHandle('a'.repeat(HANDLE_MAX + 1))).toBe('long')
  })

  it('글자로 시작해야 한다', () => {
    // 숫자로 시작하면 내부 id 와 눈으로 구분이 안 된다
    expect(checkHandle('1steel')).toBe('shape')
    expect(checkHandle('_steel')).toBe('shape')
  })

  it('밑줄로 끝날 수 없다', () => {
    expect(checkHandle('steel_')).toBe('shape')
  })

  it('밑줄이 연달아 붙을 수 없다', () => {
    expect(checkHandle('steel__yard')).toBe('run')
  })

  it('대문자와 한글, 마침표를 막는다', () => {
    expect(checkHandle('Steel')).toBe('shape')
    // 두 글자면 길이에서 먼저 걸리므로 길게 잡는다
    expect(checkHandle('홍길동입니다')).toBe('shape')
    // 마침표는 "@steelers. 안녕" 에서 경계가 흐려져 일부러 뺐다
    expect(checkHandle('steel.yard')).toBe('shape')
  })

  it('예약된 이름을 막는다', () => {
    expect(checkHandle('admin')).toBe('reserved')
    expect(checkHandle('steelers')).toBe('reserved')
    expect(checkHandle('settings')).toBe('reserved')
    // 운영자 계정의 아이디다. 남이 가져가면 운영자인 척할 수 있다 (2026-09-29)
    expect(checkHandle('poground')).toBe('reserved')
  })

  it('모든 문제에 안내 문구가 있다', () => {
    for (const p of ['short', 'long', 'shape', 'run', 'reserved'] as const) {
      expect(handleProblemMessage(p).length).toBeGreaterThan(0)
    }
  })
})

describe('입력 눕히기', () => {
  it('대문자와 공백을 정리한다', () => {
    expect(normalizeHandle('  Steel Yard  ')).toBe('steel_yard')
  })

  it('한글은 지우지 않고 밑줄로 바꾼다', () => {
    // 지워 버리면 한글 이름이 통째로 빈 값이 된다
    expect(normalizeHandle('홍길동')).toBe('')
    expect(normalizeHandle('민성7')).toBe('7')
  })

  it('밑줄이 앞뒤나 연달아 남지 않는다', () => {
    expect(normalizeHandle('__steel___yard__')).toBe('steel_yard')
  })

  it('길이를 넘기지 않는다', () => {
    expect(normalizeHandle('a'.repeat(50)).length).toBe(HANDLE_MAX)
  })
})

describe('자동 발급', () => {
  it('뽑은 것은 항상 규칙을 통과한다', () => {
    // 난수를 쓰므로 한 번만 보면 운으로 통과할 수 있다
    for (let i = 0; i < 2000; i += 1) {
      const h = randomHandle()
      expect(checkHandle(h)).toBeNull()
    }
  })

  it('예약된 이름을 뽑지 않는다', () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(RESERVED_HANDLES).not.toContain(randomHandle())
    }
  })

  /** 아이디를 불러 줄 때 헷갈리는 짝을 꼬리에서 뺐다 */
  it('꼬리에 헷갈리는 글자가 없다', () => {
    for (let i = 0; i < 2000; i += 1) {
      const tail = randomHandle().split('_').pop()!
      expect(tail).not.toMatch(/[0o1li]/)
    }
  })

  it('같은 난수면 같은 값이 나온다', () => {
    const fixed = () => 0
    expect(randomHandle(fixed)).toBe(randomHandle(fixed))
  })

  it('서로 다른 값이 충분히 나온다', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i += 1) seen.add(randomHandle())
    // 500번 뽑아 거의 안 겹쳐야 한다. 많이 겹치면 발급 때 재시도가 잦아진다
    expect(seen.size).toBeGreaterThan(490)
  })
})

// ─────────────────────────────── 화면

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider } from '@/hooks/theme/ThemeProvider'
import { HandleScreen } from '@/screens/HandleScreen'
import type { SaveAction } from '@/components/foundation/HeaderAction'

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ThemeProvider initialPreference="home">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  )

/**
 * 저장은 화면 안이 아니라 **헤더**에 걸린다.
 *
 * 화면은 누를 것을 onSaveAction 으로 올려 보내고 라우트가 그것을 헤더에 건다. 테스트에는
 * 헤더가 없으므로, 올라온 것을 받아 두었다가 직접 누른다 — 헤더가 할 일을 대신하는 셈이다.
 */
function mount(props: { initial: string; onSubmit: jest.Mock }) {
  let action: SaveAction | null = null
  wrap(<HandleScreen {...props} onSaveAction={a => (action = a)} />)
  return {
    /** 지금 저장이 잠겨 있는지. 헤더 단추의 색이 이 값으로 갈린다 */
    get disabled() {
      return action?.disabled ?? true
    },
    press: async () => {
      await act(async () => {
        await action?.onPress()
      })
    },
  }
}

describe('아이디 바꾸기 화면', () => {
  it('지금 아이디가 채워져 있다', () => {
    wrap(<HandleScreen initial="steel_7k3f" onSubmit={jest.fn()} />)
    expect(screen.getByDisplayValue('steel_7k3f')).toBeTruthy()
  })

  /**
   * 못 쓰는 글자는 **치는 동안** 걸러낸다.
   * 다 치고 나서 "영문만 됩니다" 라고 하면 지운 만큼 다시 쳐야 한다.
   */
  it('대문자와 한글은 입력되지 않는다', () => {
    wrap(<HandleScreen initial="abc" onSubmit={jest.fn()} />)
    const input = screen.getByLabelText('아이디')

    fireEvent.changeText(input, 'Steel민성YARD')
    expect(screen.getByDisplayValue('steelyard')).toBeTruthy()
  })

  /** steel_ 를 지나야 steel_yard 에 닿는다. 치는 동안 밑줄을 씹으면 만들 수가 없다 */
  it('밑줄로 끝나는 중간 상태는 입력을 막지 않는다', () => {
    wrap(<HandleScreen initial="abc" onSubmit={jest.fn()} />)
    const input = screen.getByLabelText('아이디')

    fireEvent.changeText(input, 'steel_')
    expect(screen.getByDisplayValue('steel_')).toBeTruthy()
  })

  it('밑줄로 끝난 채로는 저장되지 않는다', async () => {
    const onSubmit = jest.fn()
    const header = mount({ initial: 'abc', onSubmit })

    fireEvent.changeText(screen.getByLabelText('아이디'), 'steel_')
    await header.press()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('바꾸지 않았으면 저장이 잠긴다', async () => {
    const onSubmit = jest.fn()
    const header = mount({ initial: 'steel_7k3f', onSubmit })

    // 헤더 단추가 죽은 색으로 보여야 한다
    expect(header.disabled).toBe(true)
    await header.press()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('규칙을 통과하면 저장이 열리고 그대로 넘긴다', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const header = mount({ initial: 'abc', onSubmit })

    fireEvent.changeText(screen.getByLabelText('아이디'), 'steel_yard')
    expect(header.disabled).toBe(false)
    await header.press()
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('steel_yard'))
  })

  /** 이미 누가 쓰는 이름은 눌러 보기 전에는 알 수 없다. 서버가 돌려준 말을 보여준다 */
  it('서버가 거부한 사유를 보여준다', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('이미 누가 쓰고 있어요'))
    const header = mount({ initial: 'abc', onSubmit })

    fireEvent.changeText(screen.getByLabelText('아이디'), 'steel_yard')
    await header.press()
    await waitFor(() => expect(screen.getByText('이미 누가 쓰고 있어요')).toBeTruthy())
  })

  it('예약된 이름은 저장 전에 막는다', async () => {
    const onSubmit = jest.fn()
    const header = mount({ initial: 'abc', onSubmit })

    fireEvent.changeText(screen.getByLabelText('아이디'), 'steelers')
    await header.press()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('이미 예약된 이름이에요')).toBeTruthy()
  })
})
