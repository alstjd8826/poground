/**
 * 린트 규칙 — **훅 두 가지만** 켠다.
 *
 * 모양은 prettier 가, 타입과 안 쓰는 변수는 `tsc --noEmit` 이 이미 잡는다. 거기에
 * 겹치는 규칙을 더 켜면 같은 것을 두 번 말하면서 경고만 늘어난다. 그래서 둘 중
 * 어느 쪽도 못 보는 것 하나만 남겼다 — **훅의 의존성**.
 *
 * 이 리포가 실제로 물린 함정이라서 켠다. useEffect 의존성에 인라인 콜백이 들어가
 * 부르는 쪽이 다시 그려질 때마다 effect 가 재실행됐고, 바텀시트와 댓글 입력칸에서
 * 두 번 같은 일이 났다(CommentComposer 의 openRef 주석 참고).
 *
 * exhaustive-deps 는 error 가 아니라 warn 이다. 일부러 의존성을 뺀 자리가 있고,
 * 그런 곳은 규칙을 꺼서 침묵시키는 대신 **왜 뺐는지 주석으로 남기는** 쪽을 택했다.
 * 경고로 두면 그 자리가 계속 눈에 띄면서도 작업을 막지 않는다.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks'],
  rules: {
    // 훅을 조건문·반복문 안에서 부르면 호출 순서가 흔들려 상태가 뒤섞인다
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  /**
   * 우리가 쓴 코드만 본다.
   *
   * ios/ android/ 는 prebuild 가 만들고, supabase/ 는 Deno 라 런타임이 다르다.
   * scripts/ plugins/ 는 빌드 도구라 훅이 나올 일이 없다.
   */
  ignorePatterns: [
    'node_modules/',
    'ios/',
    'android/',
    '.expo/',
    'supabase/',
    'scripts/',
    'plugins/',
    'assets/',
  ],
}
