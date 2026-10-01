/**
 * 포항 스틸러스 구단 컬러.
 * 여기는 "원색" 만 둔다. 화면에서 직접 쓰지 말고 theme.ts 의 시맨틱 토큰을 거칠 것.
 */
const palette = {
  /** 구단 공식 4색 */
  black: '#000000',
  /** Red Orange — 구단 메인 컬러 */
  red: '#FB342E',
  /** Sandal — 오렌지/골드빛 불꽃 */
  sandal: '#FAA74A',
  white: '#FFFFFF',

  /**
   * 골키퍼 유니폼 등에 포인트로 쓰이는 시안 블루.
   * 구단이 공개한 HEX 가 없어 눈으로 맞춘 값이다. 공식 값 받으면 여기만 바꾸면 된다.
   */
  cyan: '#2FC3E3',

  /** red 의 명도 변형. 눌림/비활성 상태용 */
  red10: '#FFE9E8',
  red20: '#FFC4C2',
  red60: '#D42822',
  red80: '#8E1A16',

  sandal10: '#FFF3E3',
  sandal60: '#D98A34',

  /** 중립 계열. 검정을 기준으로 뽑아 구단 톤에서 벗어나지 않게 한다. */
  gray: {
    '0': '#FFFFFF',
    '5': '#F7F7F8',
    '10': '#EEEEF0',
    '20': '#DCDCE0',
    '30': '#BFBFC6',
    '40': '#9A9AA3',
    '50': '#75757E',
    '60': '#57575F',
    '70': '#3C3C43',
    '80': '#26262B',
    '85': '#1A1A1E',
    '90': '#131316',
    '95': '#0B0B0D',
    '100': '#000000',
  },

  /**
   * 직관 기록의 글만 있는 칸 색 (2026-09-29). 칸마다 따옴표 색(strong)과 바탕을 짝으로 두고, 바탕은 어두운
   * 테마면 deep, 밝은 테마면 pale 이다 — accentSoft 가 테마마다 그렇듯이. 테마 강조색 짝은 여기 없이
   * theme.accent/accentSoft 를 그대로 쓴다.
   */
  tiles: [
    { strong: '#5BC8F5', deep: '#0F3A4D', pale: '#E3F5FD' },
    { strong: '#2FBF71', deep: '#0E3D24', pale: '#E3F7EC' },
    { strong: '#FAA74A', deep: '#4D3312', pale: '#FFF3E3' },
    { strong: '#A78BFA', deep: '#2E2352', pale: '#F0EBFF' },
    { strong: '#F472B6', deep: '#4A1732', pale: '#FDE8F3' },
  ],

  /** 승/무/패 폼 표시용 */
  win: '#2FBF71',
  draw: '#9A9AA3',
  loss: '#FB342E',

  /**
   * 경고·퇴장 카드. 중계 화면에서 쓰는 색에 맞춘다.
   * 무승부 회색이나 구단 샌달색과 섞이면 카드로 안 읽히므로 따로 둔다.
   * 두 색은 명도 차이가 커서 색을 못 가리는 눈에도 노랑/빨강이 갈린다.
   */
  cardYellow: '#FFC72C',
  cardRed: '#E4342B',

  /**
   * 2026 골키퍼 유니폼. 구단이 "밝은 노란색과 하늘색" 이라고만 밝혔고 HEX 는 공개하지
   * 않아 눈으로 맞춘 값이다. 공식 값을 받으면 여기만 바꾸면 된다.
   *
   * 노랑은 경고 카드(cardYellow #FFC72C)보다 밝고 레몬 쪽으로 틀어 뒀다. 둘이 한 화면에
   * 나오므로 같은 노랑으로 보이면 뱃지가 강조색에 묻힌다.
   */
  keeper: {
    yellow: '#FFE14D',
    /** 어두운 바탕 위에서 accentSoft 자리에 쓸 눌린 노랑 */
    yellowSoft: '#4A3F10',
    sky: '#5BC8F5',
    /**
     * 하늘색을 머금은 어두운 중립색.
     * 홈 테마의 무채색 회색을 그대로 쓰면 노랑이 붕 떠 보인다.
     */
    background: '#0A1017',
    surface: '#111A24',
    surfaceElevated: '#18242F',
    border: '#22313F',
    textSecondary: '#A8BECD',
    textMuted: '#6B8194',
    textDisabled: '#3C4E5C',
  },

  /** 순위표의 자격/강등 띠. 구단 색과 겹치지 않게 골랐다 */
  rankAcle: '#3B82F6',
  rankAcl2: '#F0A828',
  rankRelegation: '#E4342B',
} as const

export default palette
