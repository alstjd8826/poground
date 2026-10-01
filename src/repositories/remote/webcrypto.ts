import * as ExpoCrypto from 'expo-crypto'

/**
 * WebCrypto 의 빈자리를 채운다. **supabase 클라이언트를 만들기 전에 불러야 한다.**
 *
 * 헤르메스에는 `crypto.subtle` 이 없다. 그래서 supabase 가 PKCE 챌린지를 만들 때
 * 이렇게 경고하고 물러선다:
 *
 *   WebCrypto API is not supported.
 *   Code challenge method will default to use plain instead of sha256.
 *
 * `plain` 은 **검증값을 그대로 인증 주소에 실어 보낸다.** PKCE 가 막으려던 것이 바로
 * 그 주소를 들여다본 쪽이 코드를 가로채 쓰는 일인데, 검증값이 같이 실려 가면 막을 것이
 * 없어진다. S256 은 해시만 보내므로 주소를 봐도 검증값을 알 수 없다.
 *
 * expo-crypto 가 네이티브 해시를 들고 있으니 그것을 `crypto.subtle.digest` 모양으로
 * 덮어 준다. 이미 있는 것은 건드리지 않는다 — 런타임이 나중에 제 것을 갖추면 그쪽이
 * 이긴다.
 */
type Algorithm = string | { name: string }

function nameOf(algorithm: Algorithm): string {
  if (typeof algorithm === 'string') return algorithm
  return algorithm.name
}

/**
 * 최소한의 UTF-8 인코더.
 *
 * supabase 가 `TextEncoder` 도 함께 본다. 없으면 `crypto.subtle` 을 갖춰 놔도 다시
 * plain 으로 떨어진다. 넣는 값이 16진수 문자열뿐이지만, 전역에 놓는 물건이라 다른 곳에서
 * 한글을 넣어도 맞게 나오도록 대리쌍까지 처리한다.
 */
export class MinimalTextEncoder {
  readonly encoding = 'utf-8'

  encode(input = ''): Uint8Array {
    const out: number[] = []
    for (let i = 0; i < input.length; i++) {
      const point = input.codePointAt(i) as number
      // 대리쌍은 두 칸을 한 글자로 읽는다
      if (point > 0xffff) i++

      if (point < 0x80) {
        out.push(point)
      } else if (point < 0x800) {
        out.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f))
      } else if (point < 0x10000) {
        out.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 0x3f), 0x80 | (point & 0x3f))
      } else {
        out.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 0x3f),
          0x80 | ((point >> 6) & 0x3f),
          0x80 | (point & 0x3f),
        )
      }
    }
    return new Uint8Array(out)
  }
}

export function installWebCrypto() {
  const globals = globalThis as unknown as Record<string, unknown>

  if (typeof globals.TextEncoder === 'undefined') {
    globals.TextEncoder = MinimalTextEncoder
  }

  if (typeof globals.crypto === 'undefined') {
    globals.crypto = {}
  }
  const crypto = globals.crypto as Record<string, unknown>

  if (typeof crypto.getRandomValues !== 'function') {
    crypto.getRandomValues = ExpoCrypto.getRandomValues
  }

  if (typeof crypto.subtle === 'undefined') {
    crypto.subtle = {
      digest: (algorithm: Algorithm, data: BufferSource) =>
        ExpoCrypto.digest(nameOf(algorithm) as ExpoCrypto.CryptoDigestAlgorithm, data),
    }
  }
}
