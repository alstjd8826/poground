import { exchangeInForeground, isCancelledRequest } from '@/hooks/auth/exchange'

/**
 * 카카오 로그인은 카카오톡 앱에 다녀온다. 돌아오는 순간 인앱 브라우저가 끝났다고 알려 오는데,
 * 그때 앱이 아직 완전히 앞으로 나오지 않았으면 iOS 가 막 출발한 교환 요청(POST)을 끊는다.
 * 사용자에게는 "fetch failed: … 취소됨" 이 떴고, 다시 누르면 됐다 (2026-09-28).
 */

const cancelled = {
  error: new Error('fetch failed: UnexpectedException: 취소됨 (at ExpoModulesCore/Promise.swift:56)'),
}
const ok = { error: null }

describe('취소된 요청 가리기', () => {
  it('iOS 가 끊은 요청을 알아본다 (한국어·영어)', () => {
    expect(isCancelledRequest(cancelled.error)).toBe(true)
    expect(isCancelledRequest(new Error('fetch failed: cancelled'))).toBe(true)
  })

  it('다른 오류는 취소로 보지 않는다', () => {
    expect(isCancelledRequest(new Error('invalid flow state, no valid flow state found'))).toBe(false)
    expect(isCancelledRequest(null)).toBe(false)
  })
})

describe('앞으로 나온 뒤에 교환하기', () => {
  it('앱이 앞으로 나올 때까지 기다렸다가 교환한다', async () => {
    const order: string[] = []
    let becomeActive: () => void = () => {}
    const active = jest.fn(() => {
      order.push('wait')
      return new Promise<void>(resolve => (becomeActive = resolve))
    })
    const exchange = jest.fn(async () => {
      order.push('exchange')
      return ok
    })

    const done = exchangeInForeground(exchange, active)
    await Promise.resolve()
    expect(exchange).not.toHaveBeenCalled()
    becomeActive()
    await done
    expect(order).toEqual(['wait', 'exchange'])
  })

  /**
   * 다시 보내지 않는다. supabase 는 교환 요청이 네트워크에서 실패하면 기기에 둔 PKCE 비밀값을
   * 지운다 — 같은 코드로 다시 보내면 "code verifier not found" 로 반드시 실패한다. 대신 무엇을
   * 하면 되는지 우리 말로 알린다.
   */
  it('끊기면 다시 보내지 않고 다시 눌러 달라고 알린다', async () => {
    const exchange = jest.fn().mockResolvedValue(cancelled)
    await expect(exchangeInForeground(exchange, async () => {})).rejects.toThrow('한 번 더 눌러 주세요')
    expect(exchange).toHaveBeenCalledTimes(1)
  })

  /** 코드가 틀렸거나 이미 쓴 경우는 다시 해도 같다. 그대로 알린다 */
  it('다른 오류는 다시 시도하지 않고 던진다', async () => {
    const exchange = jest.fn().mockResolvedValue({ error: new Error('invalid grant') })
    await expect(exchangeInForeground(exchange, async () => {})).rejects.toThrow('invalid grant')
    expect(exchange).toHaveBeenCalledTimes(1)
  })

  it('던져진 취소도 같게 다룬다', async () => {
    const exchange = jest.fn().mockRejectedValue(cancelled.error)
    await expect(exchangeInForeground(exchange, async () => {})).rejects.toThrow('한 번 더 눌러 주세요')
    expect(exchange).toHaveBeenCalledTimes(1)
  })
})
