/**
 * 카카오가 내려 준 사진 주소를 쓸 만한 값으로 다듬는다.
 *
 * 두 가지를 걸러야 한다.
 *
 * 1. **기본 프로필 이미지.** 사용자가 카카오에 사진을 안 걸어 두면 카카오는 빈 값이
 *    아니라 자기 기본 이미지(account_images/default_profile)를 준다. 그대로 쓰면
 *    우리 앱에서도 흰 동그라미가 되고, 정작 우리가 준비한 선수 실루엣은 안 나온다.
 *    "사진 없음" 으로 봐야 한다.
 * 2. **http 주소.** 카카오는 http 로 주는 경우가 있고, iOS 는 ATS 때문에 그냥
 *    안 그린다. 같은 호스트가 https 를 받으므로 올려서 쓴다.
 */
export function normalizeKakaoAvatar(url: string | null | undefined): string | null {
  if (!url) return null

  // 카카오는 원본 주소를 fname 쿼리에 **인코딩해서** 감싸 준다.
  //   .../thumb/R640x640.q70/?fname=http%3A%2F%2F...%2Faccount_images%2Fdefault_profile.jpeg
  // 그래서 슬래시로만 찾으면 못 잡는다. 풀어서 본다
  let decoded = url
  try {
    decoded = decodeURIComponent(url)
  } catch {
    // 잘못 인코딩된 주소면 원본으로 판단한다. 못 읽는다고 버릴 이유는 없다
  }
  if (decoded.includes('account_images/default_profile')) return null

  return url.replace(/^http:\/\//, 'https://')
}
