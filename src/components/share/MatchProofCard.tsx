import { forwardRef } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import { fontFamily, palette, spacing } from '@/styles'
import type { MatchProofData } from '@/models/shareCard'
import { CARD_HEIGHT, CARD_WIDTH } from './FairyCard'

const OUTCOME = { win: '승', draw: '무', loss: '패' } as const

/**
 * 한 경기 직관 인증 카드 (2026-09-30). 승리요정 카드와 같은 크기·바탕이다.
 *
 * 그 경기에 쓴 내 직관 글에 사진이 있으면 첫 장을 배경으로 깔고 어둡게 덮는다 — 사진이 무엇이든 흰 글자가 읽히게.
 * 없으면 포그라운드 빨강. 구단 엠블럼은 싣지 않고 팀 이름만 글자로 쓴다(승리요정 카드와 같은 까닭).
 */
export const MatchProofCard = forwardRef<
  View,
  { data: MatchProofData; handle: string | null; photoUri: string | null }
>(function MatchProofCard({ data, handle, photoUri }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      {photoUri && (
        <>
          <Image
            source={{ uri: photoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel="직관 사진"
          />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      )}

      <View style={styles.head}>
        <Text style={styles.brand}>포그라운드</Text>
        <Text style={styles.title}>직관 인증</Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.teams}>
          <Text style={styles.team} numberOfLines={1}>
            {data.us}
          </Text>
          <Text style={styles.vs}>{data.side === '홈' ? 'HOME' : 'AWAY'}</Text>
          <Text style={[styles.team, styles.teamRight]} numberOfLines={1}>
            {data.them}
          </Text>
        </View>
        <Text style={styles.score} numberOfLines={1} adjustsFontSizeToFit>
          {`${data.ourGoal} : ${data.theirGoal}`}
        </Text>
        <View style={[styles.chip, data.outcome === 'win' && styles.chipWin]}>
          <Text style={[styles.chipText, data.outcome === 'win' && styles.chipTextWin]}>
            {OUTCOME[data.outcome]}
          </Text>
        </View>
      </View>

      <View style={styles.foot}>
        <Text style={styles.meta}>{data.stadium ? `${data.date} · ${data.stadium}` : data.date}</Text>
        <Text style={styles.handle}>{handle ? `@${handle}` : '포항 팬'}</Text>
      </View>
    </View>
  )
})

const WHITE = palette.white
const FAINT = 'rgba(255,255,255,0.78)'

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.red,
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['400'],
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  head: { gap: spacing['050'] },
  brand: { fontFamily: fontFamily.dynamic, fontSize: 15, color: FAINT, letterSpacing: 0.5 },
  title: { fontFamily: fontFamily.dynamic, fontSize: 22, lineHeight: 30, color: WHITE },
  hero: { alignItems: 'center', gap: spacing['150'] },
  teams: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing['100'] },
  team: { flex: 1, fontFamily: fontFamily.dynamic, fontSize: 24, lineHeight: 32, color: WHITE },
  teamRight: { textAlign: 'right' },
  vs: { fontFamily: fontFamily.dynamic, fontSize: 12, color: FAINT, letterSpacing: 1 },
  score: {
    fontFamily: fontFamily.dynamic,
    fontSize: 88,
    lineHeight: 96,
    letterSpacing: -2,
    color: WHITE,
    fontVariant: ['tabular-nums'],
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['050'],
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: WHITE,
    alignItems: 'center',
  },
  chipWin: { backgroundColor: WHITE },
  chipText: { fontFamily: fontFamily.dynamic, fontSize: 20, lineHeight: 26, color: WHITE },
  chipTextWin: { color: palette.red },
  foot: { gap: spacing['050'] },
  meta: { fontFamily: fontFamily.dynamic, fontSize: 15, lineHeight: 20, color: WHITE },
  handle: { fontFamily: fontFamily.dynamic, fontSize: 16, color: WHITE },
})
