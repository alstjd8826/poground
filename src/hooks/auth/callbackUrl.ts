/**
 * 돌아온 주소가 실어 온 거절 사유.
 *
 * 문구는 서버가 영어로 준다. 그대로 띄우면 읽는 사람이 무엇을 해야 할지 모르므로,
 * 부르는 쪽이 갈라 보고 우리 말로 안내할 수 있게 사유를 따로 들려 보낸다.
 */
export class CallbackError extends Error {
  readonly reason: string | null

  constructor(message: string, reason: string | null) {
    super(message)
    this.name = 'CallbackError'
    this.reason = reason
  }
}

/** 이 소셜이 이미 다른 계정에 물려 있는 경우인가 */
export function isAlreadyLinked(e: unknown): boolean {
  if (e instanceof CallbackError && e.reason === 'identity_already_exists') return true
  // 사유 없이 설명만 오는 경우가 있어 문구로도 한 번 더 본다
  return e instanceof Error && /already linked|already exists/i.test(e.message)
}

/**
 * 로그인·연동이 끝나고 앱으로 돌아온 주소에서 인증 코드를 꺼낸다.
 *
 * 돌아오는 길은 두 갈래다. 잘 끝나면 `code` 가 붙어 오고, 서버가 거절하면 `code` 대신
 * `error` 와 `error_description` 이 붙어 온다. 앞의 것만 읽으면 **거절당한 것과 아무
 * 일도 안 일어난 것이 구분되지 않는다** — 연동이 막혀 있는데도 화면이 조용히 그대로
 * 있던 것이 이 때문이었다.
 *
 * 값은 질의 문자열과 조각(#) 양쪽을 본다. PKCE 는 질의로 보내지만 일부 오류는 조각으로
 * 온다. 어느 쪽에 실렸는지로 갈라 읽을 이유가 없어 둘 다 뒤진다.
 */
export function codeFromCallback(url: string): string {
  const parsed = new URL(url)
  const query = new URLSearchParams(parsed.search)
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const read = (key: string) => query.get(key) ?? fragment.get(key)

  const code = read('code')
  if (code) return code

  const reason = read('error_code') ?? read('error')
  // 서버가 준 설명을 그대로 올린다. 우리가 지어낸 문구보다 원인에 가깝다
  const description = read('error_description')
  if (description) throw new CallbackError(description, reason)
  if (reason) throw new CallbackError(reason, reason)

  throw new CallbackError('돌아온 주소에 인증 코드도 오류도 없습니다', null)
}
