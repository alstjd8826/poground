/**
 * 아이디(handle).
 *
 * 닉네임과 역할이 다르다. 닉네임은 **보여주는 이름** 이라 겹쳐도 되고 한글도 되지만,
 * handle 은 **@로 가리키는 이름** 이라 유일해야 하고 글자를 좁혀야 한다.
 *
 * 규칙은 인스타그램·X·깃허브에서 겹치는 관행을 따랐다.
 *   - 소문자 + 숫자 + 밑줄만
 *   - 3~20자
 *   - 글자로 시작 (숫자로 시작하면 내부 id 와 눈으로 구분이 안 된다)
 *   - 밑줄로 끝나지 않고, 연달아 붙지 않음
 *
 * 마침표는 일부러 뺐다. 인스타그램은 허용하지만 "@steelers. 안녕" 처럼 문장 끝
 * 마침표와 경계가 흐려져, @로 사람을 가리키는 파싱이 흔들린다.
 *
 * DB 쪽 제약은 0007_profile_handle.sql 에 같은 내용으로 걸려 있다. 둘 중 하나만
 * 고치면 조용히 어긋나므로 같이 고쳐야 한다.
 */

export const HANDLE_MIN = 3
export const HANDLE_MAX = 20

const SHAPE = /^[a-z][a-z0-9_]{1,18}[a-z0-9]$/
const RUN = /__/

/**
 * 남이 가져가면 곤란한 이름.
 *
 * 나중에 `/@handle` 같은 주소를 쓰게 되면 경로와 부딪히는 이름들이고, 구단이나
 * 운영자를 사칭할 수 있는 이름들이다. DB 에는 이 중 제일 위험한 둘만 걸어 뒀고
 * 목록 관리는 여기서 한다 — 이름을 하나 더할 때마다 마이그레이션을 쓸 일은 아니다.
 */
// 낱말 목록이라 포맷을 맡기지 않는다. 한 줄에 하나씩 터지면 60줄이 되고 갈래가 안 읽힌다
// prettier-ignore
export const RESERVED_HANDLES: readonly string[] = [
  // 운영·사칭
  'admin', 'administrator', 'official', 'staff', 'support', 'help', 'root',
  'steelers', 'pohang', 'pohangsteelers', 'kleague', 'poground',
  // 주소로 쓸 만한 말
  'about', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'settings',
  'me', 'you', 'user', 'users', 'profile', 'profiles', 'home', 'search',
  'card', 'cards', 'community', 'news', 'match', 'matches', 'club', 'my',
  'null', 'undefined', 'anonymous', 'deleted',
]

/** 입력을 규칙에 맞는 모양으로 눕힌다. 유일성과 예약어는 여기서 보지 않는다 */
export function normalizeHandle(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      // 허용하지 않는 글자는 밑줄로 바꾼다. 지워 버리면 "홍길동" 이 빈 값이 된다
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '')
      .slice(0, HANDLE_MAX)
  )
}

export type HandleProblem = 'short' | 'long' | 'shape' | 'run' | 'reserved'

/** 무엇이 틀렸는지 돌려준다. 맞으면 null */
export function checkHandle(handle: string): HandleProblem | null {
  if (handle.length < HANDLE_MIN) return 'short'
  if (handle.length > HANDLE_MAX) return 'long'
  if (RUN.test(handle)) return 'run'
  if (!SHAPE.test(handle)) return 'shape'
  if (RESERVED_HANDLES.includes(handle)) return 'reserved'
  return null
}

export function isValidHandle(handle: string): boolean {
  return checkHandle(handle) === null
}

/** 화면에 띄울 말. 규칙을 외우게 하지 않고 무엇을 고치면 되는지만 알려준다 */
export function handleProblemMessage(problem: HandleProblem): string {
  switch (problem) {
    case 'short':
      return `${HANDLE_MIN}자 이상이어야 해요`
    case 'long':
      return `${HANDLE_MAX}자까지 쓸 수 있어요`
    case 'run':
      return '밑줄을 연달아 쓸 수 없어요'
    case 'shape':
      return '영문 소문자로 시작하고, 소문자·숫자·밑줄만 쓸 수 있어요'
    case 'reserved':
      return '이미 예약된 이름이에요'
  }
}

/**
 * 자동으로 나눠 줄 이름.
 *
 * 사람이 읽을 수 있는 낱말 + 짧은 꼬리로 만든다. 순수 난수 문자열은 짧게 만들면
 * 금방 겹치고, 길게 만들면 아무도 자기 아이디를 기억하지 못한다.
 *
 * 꼬리의 글자판에서 0/o/1/l/i 를 뺐다. 남에게 아이디를 불러 줄 때 헷갈리는 짝이다.
 */
const WORDS: readonly string[] = [
  'steel',
  'flame',
  'iron',
  'dolgi',
  'sunny',
  'wave',
  'east',
  'blue',
  'kick',
  'goal',
  'wing',
  'shot',
  'pass',
  'cheer',
  'horn',
  'drum',
  'yard',
  'north',
  'south',
  'tiger',
  'eagle',
  'spark',
  'rise',
  'bold',
]
const TAIL = 'abcdefghjkmnpqrstuvwxyz23456789'

export function randomHandle(random: () => number = Math.random): string {
  const word = WORDS[Math.floor(random() * WORDS.length)]!
  let tail = ''
  for (let i = 0; i < 4; i += 1) {
    tail += TAIL[Math.floor(random() * TAIL.length)]!
  }
  return `${word}_${tail}`
}
