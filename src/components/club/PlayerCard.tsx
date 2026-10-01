import { StyleSheet, Text, View } from 'react-native'
import { useImage } from '@shopify/react-native-skia'

import { HoloImage } from '@/components/holo/HoloImage'
import { HoloLayer } from '@/components/holo/HoloLayer'
import { HoloSurface } from '@/components/holo/HoloSurface'
import { SHINE_LABELS, SHINE_KEYS, type ShineKey } from '@/components/holo/shine'
import { PlayerSilhouette } from '@/components/club/PlayerPhoto'
import { type CardPattern, usePlayerCardArt } from '@/components/club/playerCardArt'
import { fontFamily, fonts, palette, spacing } from '@/styles'
import type { Player } from '@/models/kleague'

/** 포켓몬 카드 비율. 실물 카드 규격이라 손에 쥔 느낌이 난다 */
export const CARD_ASPECT = 0.718

/** 카드 안에서 누끼가 놓이는 자리. 0..1 비율이라 카드 크기와 무관하다 */
const PHOTO_RECT = { x: 0.07, y: 0.03, width: 0.86, height: 0.8 }

/**
 * 포지션별 색.
 *
 * 카드 바탕과 발광이 같은 색을 쓴다. 이름을 읽기 전에 색으로 먼저 무슨 포지션인지
 * 알아채라는 것이고, 스쿼드를 포지션 순으로 늘어놓았을 때 띠처럼 묶여 보인다.
 */
const POSITION_COLOR: Record<string, string> = {
  FW: palette.red,
  MF: palette.sandal,
  DF: palette.cyan,
  GK: palette.win,
}
const POSITION_COLOR_DEFAULT = palette.gray['50']

/** 0..255 hex -> 셰이더가 쓰는 0..1 三원색 */
function toGlow(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * 카드 등급.
 *
 * 포지션이 색을 정하고, 여기서 정하는 등급이 반짝임을 정한다. 둘을 갈라 놓은 이유는
 * 공격 기록만으로 등급을 매기면 수비수와 골키퍼가 전부 맨 아래에 깔리기 때문이다.
 * 출전과 공격을 따로 세어 더한다 — 많이 뛴 것도 그 자체로 기여다.
 *
 * 기준은 2026 시즌 포항 37명의 실제 분포에서 잡았다 (29경기 소화 시점, 최다 출전 28,
 * 최다 득점 8, 28명이 무득점). 출전 20 / 10 과 공격포인트 10 / 4 에서 갈린다.
 */
export type CardTier = 0 | 1 | 2 | 3 | 4

/** 출전 수로 매기는 몫. 구간이 셋이라 이른 반환으로 한 줄에 하나씩 둔다 */
function tierByApps(apps: number) {
  if (apps >= 20) return 2
  if (apps >= 10) return 1
  return 0
}

/** 공격 포인트로 매기는 몫 */
function tierByAttack(attack: number) {
  if (attack >= 10) return 2
  if (attack >= 4) return 1
  return 0
}

function tierOf(p: Player): CardTier {
  const byApps = tierByApps(p.appearances)
  // 골이 도움보다 귀하다. 위 분포에서 골은 25개, 도움은 18개뿐이다
  const attack = p.goals * 2 + p.assists
  const byAttack = tierByAttack(attack)
  // 둘 다 0..2 이므로 합은 0..4 다
  return (byApps + byAttack) as CardTier
}

interface TierStyle {
  effect: ShineKey
  /** 바탕에 새길 무늬. 문지르지 않고 목록에서 봐도 등급이 읽히게 하는 쪽이다 */
  pattern: CardPattern
  /**
   * 반짝임을 카드 안쪽으로 가둘지.
   *
   * 가두면 테두리와 이름표는 안 반짝여 인쇄된 카드처럼 보이고, 안 가두면 카드 전체가
   * 한 장의 포일이 된다. 실물 카드도 등급이 올라가면 이렇게 바뀐다.
   */
  masked: boolean
  /** 등급 이름. 카드를 열었을 때 한 줄로 알려 준다 */
  label: string
}

/**
 * 등급별 홀로.
 *
 * 이름은 포켓몬 등급에서 왔지만 고른 기준은 "얼마나 더 요란한가" 뿐이다.
 * reverse-holo 는 마스크가 없으면 그림창 바깥만 반짝이도록 되어 있어 반드시 가둬야 한다.
 */
const TIERS: Record<CardTier, TierStyle> = {
  0: { effect: 'none', pattern: 'streak', masked: false, label: '기본' },
  1: { effect: 'gloss', pattern: 'comb', masked: true, label: '광택' },
  2: { effect: 'brushed', pattern: 'halo', masked: true, label: '강철' },
  3: { effect: 'prism', pattern: 'lattice', masked: true, label: '굴절' },
  4: { effect: 'sparkle', pattern: 'nebula', masked: true, label: '반짝이' },
}

/** 카드 등급 이름. 화면이 "이 카드가 왜 이렇게 생겼는지" 를 말해 줄 때 쓴다 */
export function tierLabelOf(player: Player): string {
  return TIERS[tierOf(player)].label
}

/**
 * 카드의 겉모습.
 *
 * 선수 카드는 이걸 기록에서 자동으로 뽑지만(lookOf), 직접 만드는 카드는 사용자가 고른다.
 * 그래서 "무엇으로 정하는가" 와 "어떻게 생겼는가" 를 갈라 둔다. 무늬와 홀로도 따로 고를 수
 * 있어야 해서, 등급표에서 짝지어 둔 것을 여기서는 풀어 둔다.
 */
export interface CardLook {
  /** 바탕과 발광에 쓰는 색 */
  tint: string
  pattern: CardPattern
  effect: ShineKey
  /** 반짝임을 카드 안쪽으로 가둘지 */
  masked: boolean
}

/**
 * 반짝임을 카드 안쪽으로 가둘지.
 *
 * 빛이 없는 카드는 가둘 것도 없다. 나머지는 테두리와 이름표를 빼고 안쪽에서만 흐르게 해야
 * 인쇄된 카드처럼 보인다.
 */
export function maskedFor(effect: ShineKey): boolean {
  return effect !== 'none'
}

/** 포지션과 기록으로 겉모습을 정한다. 선수 카드의 기본값이다 */
export function lookOf(player: Player): CardLook {
  const tier = TIERS[tierOf(player)]
  return {
    tint: POSITION_COLOR[player.position ?? ''] ?? POSITION_COLOR_DEFAULT,
    pattern: tier.pattern,
    effect: tier.effect,
    masked: tier.masked,
  }
}

/** 직접 고를 때 보여줄 무늬 목록 */
export const CARD_PATTERNS: Array<{ key: CardPattern; label: string }> = [
  { key: 'streak', label: '사선 결' },
  { key: 'comb', label: '빗살' },
  { key: 'halo', label: '동심원' },
  { key: 'lattice', label: '격자' },
  { key: 'nebula', label: '성운' },
]

/** 직접 고를 때 보여줄 빛 목록 */
export const CARD_EFFECTS: Array<{ key: ShineKey; label: string }> = SHINE_KEYS.map(key => ({
  key,
  label: SHINE_LABELS[key],
}))

export interface PlayerCardProps {
  player: Player
  /** 카드 폭(pt). 높이는 비율로 정해진다 */
  width: number
  /** 겉모습을 직접 정할 때. 안 주면 기록에서 뽑는다 */
  look?: CardLook
  /**
   * 아래 기록 줄을 보여줄지.
   *
   * 팬 카드처럼 기록이 없는 카드는 0 만 늘어놓게 되므로 숨긴다.
   */
  showStats?: boolean
}

/**
 * 선수 홀로 카드.
 *
 * 바탕은 그 자리에서 그리고, 누끼 사진과 글자는 그 위에 얹는다. 사진을 바탕에 구워
 * 넣지 않는 이유는 기울일 때 사진만 따로 움직여야 하기 때문이다 — 카드 면보다 앞에
 * 있는 것처럼 어긋나면서 테두리 밖으로 살짝 빠져나온다.
 */
export function PlayerCard({ player, width, look, showStats = true }: PlayerCardProps) {
  const tier = look ?? lookOf(player)
  const { tint } = tier
  const photo = useImage(player.photoUrl)
  const { art, mask, glitter } = usePlayerCardArt(CARD_ASPECT, tint, tier.pattern)

  return (
    <HoloSurface
      image={art}
      mask={tier.masked ? mask : null}
      effect={tier.effect}
      sparkle={glitter}
      glow={toGlow(tint)}
      width={width}
      aspect={CARD_ASPECT}
    >
      {/* 등번호는 오른쪽 위 구석에 앉는다. 가운데에 두면 선수 머리가 정확히 그 자리를 덮어
          있으나 마나 했다. 사진 뒤에 남도록 사진보다 먼저 쌓는다 — 층 순서가 곧 그리는 순서다 */}
      <HoloLayer depth={8} style={styles.backNoLayer}>
        {player.backNo != null && (
          <Text style={[styles.backNo, { color: tint, fontSize: width * 0.26 }]}>{player.backNo}</Text>
        )}
      </HoloLayer>

      {/* 누끼. 가장 많이 떠 있다 — 카드에서 빠져나오는 건 이것뿐이다.
          실물 카드처럼 빛이 선수 위로도 지나가야 해서 스키아로 그린다 */}
      <HoloLayer depth={26} style={styles.photoLayer}>
        {photo ? <HoloImage image={photo} rect={PHOTO_RECT} /> : <PlayerSilhouette style={styles.photo} />}
      </HoloLayer>

      {/* 이름표. 카드 면에 인쇄된 것이라 거의 안 뜬다 */}
      <HoloLayer depth={3} style={styles.panel}>
        <View
          style={{
            paddingHorizontal: width * 0.08,
            paddingBottom: width * 0.07,
          }}
        >
          {/*
            비어 있어도 글자 상자는 남긴다. 대체 글자('포지션 미상' 같은 것)만 없앴다.
            아예 안 그리면 아래에 붙은 이름·한 줄이 위로 올라와 카드마다 글자 자리가
            달라진다 — 이름 없는 카드에서 한 줄이 아래로 내려앉는 식이다.
          */}
          <Text style={[fonts.label, styles.shadow, { color: tint }]}>{player.position ?? ''}</Text>
          <Text style={[styles.name, styles.shadow, { fontSize: width * 0.105 }]} numberOfLines={1}>
            {player.name}
          </Text>
          {showStats && (
            <View style={styles.statRow}>
              <Stat label="출전" value={player.appearances} />
              <Stat label="골" value={player.goals} />
              <Stat label="도움" value={player.assists} />
              <Stat label="슈팅" value={player.shots} />
            </View>
          )}
        </View>
      </HoloLayer>
    </HoloSurface>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={[fonts.numericSmall, styles.statValue, styles.shadow]}>{value}</Text>
      <Text style={[fonts.label, styles.statLabel, styles.shadow]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // 층은 전부 카드 전체를 덮고, 안에서 자기 자리를 잡는다. 그래야 기울여 밀려나도
  // 카드 테두리에 잘리지 않는다
  photoLayer: { alignItems: 'center', justifyContent: 'flex-start' },
  /**
   * 사진이 없는 선수의 자리표시자. 실제 사진은 스키아가 PHOTO_RECT 자리에 그린다.
   *
   * 여기에 변형을 하나라도 더 얹으면 안 된다. 카드를 기울이면 iOS 가 이 층을 텍스처로
   * 구워 비스듬히 늘려 붙이는데, 그 전에 스케일이 한 겹 더 있으면 리샘플링이 두 번 걸려
   * 그만큼 더 뭉갠다. 실제로 재 봤다 — 뷰를 1.35배로 키우고 도로 줄이면(픽셀을 더 주려는
   * 의도였다) 선명도가 오히려 3분의 1로 떨어졌다. 보이는 크기 그대로 두는 것이 가장 선명하다.
   */
  photo: { width: '86%', height: '80%', marginTop: '3%' },
  backNoLayer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    // 테두리에 붙지 않게 띄운다. 마스크가 시작하는 자리(4.5%)보다 안쪽이어야 한다
    paddingRight: '7%',
    paddingTop: '3%',
  },
  backNo: {
    fontFamily: fontFamily.dynamic,
    // 가운데에 있을 때는 0.22 였다. 구석으로 옮기며 가릴 것이 없어져 더 진하게 둘 수 있다
    opacity: 0.5,
    fontVariant: ['tabular-nums'],
  },
  panel: { justifyContent: 'flex-end' },
  /**
   * 이름표 글자의 그림자.
   *
   * 선수가 이름표 앞으로 나오는 구도라 글자가 유니폼 위에 겹친다. 유니폼 색이 선수마다
   * 다르니 글자 색을 어떻게 잡아도 어딘가에선 묻힌다 — 대신 글자 뒤를 어둡게 깔아
   * 바탕이 무엇이든 떠 보이게 한다. 겹침 자체는 실물 카드에서도 쓰는 구도라 살린다.
   */
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // 이 서체는 Medium 과 ExtraBold 두 벌뿐이라 fontWeight 로는 굵기가 안 잡힌다.
  // 굵기는 패밀리로 고르고, 크기는 카드 폭에 맞춰 밖에서 준다
  name: { color: palette.white, fontFamily: fontFamily.dynamic },
  statRow: {
    flexDirection: 'row',
    marginTop: spacing['075'],
    gap: spacing['150'],
  },
  stat: { alignItems: 'flex-start' },
  statValue: { color: palette.white },
  statLabel: { color: palette.gray['40'] },
})
