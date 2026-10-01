/**
 * 환경 값.
 *
 * Expo 는 `EXPO_PUBLIC_` 으로 시작하는 변수를 .env 에서 읽어 번들에 넣어준다(babel-preset-expo).
 * 별도 라이브러리가 필요 없고, 값이 바뀌면 Metro 를 재시작하면 반영된다.
 *
 * anon 키는 공개되어도 되는 값이다. 모든 테이블에 "public read" 정책만 걸려 있고
 * 쓰기는 service_role(Edge Function)만 한다. 그래도 리포에 커밋하지는 않는다(.env 는 gitignore).
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    // 여기서 던지면 앱이 아예 안 뜨므로, 화면이 에러 상태를 보여주도록 빈 값을 넘긴다.
    console.warn(`[env] ${name} 이 비어 있습니다. .env 를 확인하세요 (.env.example 참고)`)
    return ''
  }
  return value
}

export const SUPABASE_URL = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL)

/**
 * 공개 키. 두 이름을 모두 받는다.
 *   - EXPO_PUBLIC_SUPABASE_KEY       : Supabase Connect 대화상자가 알려주는 최신 이름 (sb_publishable_...)
 *   - EXPO_PUBLIC_SUPABASE_ANON_KEY  : 예전 이름 (eyJ... JWT 형태의 anon 키)
 *
 * process.env 는 Expo 가 빌드 시점에 정적으로 치환하므로, 반드시 이렇게 각각 써야 한다.
 * 변수로 키 이름을 만들어 접근하면 치환이 안 돼서 값이 비어 버린다.
 */
export const SUPABASE_ANON_KEY = required(
  'EXPO_PUBLIC_SUPABASE_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
)

/** 설정이 끝났는지. 화면이 "연결 안 됨" 을 구분해 보여줄 때 쓴다. */
export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0

export const SEASON_YEAR = Number(process.env.EXPO_PUBLIC_SEASON_YEAR ?? 2026)
