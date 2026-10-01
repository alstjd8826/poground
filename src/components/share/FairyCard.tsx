import { forwardRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { fontFamily, palette, spacing } from '@/styles'
import type { FairyCardData, RecentLine } from '@/models/shareCard'

/** 카드의 논리 크기. 스토리 비율 9:16 — 찍을 때 1080×1920 으로 키운다 */
export const CARD_WIDTH = 360
export const CARD_HEIGHT = 640

const OUTCOME = { win: '승', draw: '무', loss: '패' } as const

/**
 * 승리요정 공유 카드 (2026-09-30).
 *
 * 테마를 따르지 않는다 — 밖으로 나가는 이미지라 누가 올려도 같은 카드여야 한다. 포그라운드 빨강 바탕에 흰 글자.
 * 구단 엠블럼은 싣지 않고 팀 이름만 글자로 쓴다. 앱 안과 달리 이미지가 밖으로 퍼지므로 남의 상표를 얹지 않는다.
 */
export const FairyCard = forwardRef<View, { data: FairyCardData; handle: string | null; season: number }>(
  function FairyCard({ data, handle, season }, ref) {
    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.brand}>포그라운드</Text>
          <Text style={styles.subtitle}>{`${season} 시즌 승리요정`}</Text>
        </View>

        <View style={styles.hero}>
          {/* 100% 처럼 세 자리면 두 줄로 접혔다. 한 줄에 두고 넘치면 글자를 줄인다 */}
          <Text style={styles.rate} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {data.rate}
          </Text>
          <Text style={styles.tally}>
            {`직관 ${data.played}경기 · ${data.wins}승 ${data.draws}무 ${data.losses}패`}
          </Text>
        </View>

        <View style={styles.recent}>
          <Text style={styles.recentTitle}>최근 직관</Text>
          {data.recent.map(line => (
            <Line key={line.gameId} line={line} />
          ))}
        </View>

        <View style={styles.foot}>
          <Text style={styles.handle}>{handle ? `@${handle}` : '포항 팬'}</Text>
        </View>
      </View>
    )
  },
)

function Line({ line }: { line: RecentLine }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineText, styles.date]}>{line.date}</Text>
      <Text style={[styles.lineText, styles.opponent]} numberOfLines={1}>
        {line.opponent}
      </Text>
      <Text style={[styles.lineText, styles.score]}>{line.score}</Text>
      <View style={[styles.chip, line.outcome === 'win' && styles.chipWin]}>
        <Text style={[styles.chipText, line.outcome === 'win' && styles.chipTextWin]}>
          {OUTCOME[line.outcome]}
        </Text>
      </View>
    </View>
  )
}

const WHITE = palette.white
const FAINT = 'rgba(255,255,255,0.72)'

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: palette.red,
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['400'],
    justifyContent: 'space-between',
  },
  head: { gap: spacing['050'] },
  brand: { fontFamily: fontFamily.dynamic, fontSize: 15, color: FAINT, letterSpacing: 0.5 },
  subtitle: { fontFamily: fontFamily.dynamic, fontSize: 22, lineHeight: 30, color: WHITE },
  hero: { gap: spacing['100'] },
  rate: { fontFamily: fontFamily.dynamic, fontSize: 104, lineHeight: 112, letterSpacing: -3, color: WHITE },
  tally: { fontFamily: fontFamily.dynamic, fontSize: 18, lineHeight: 24, color: WHITE },
  recent: { gap: spacing['100'] },
  recentTitle: { fontFamily: fontFamily.dynamic, fontSize: 13, color: FAINT },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  lineText: { fontFamily: fontFamily.dynamic, fontSize: 17, lineHeight: 24, color: WHITE },
  date: { width: 44, color: FAINT },
  opponent: { flex: 1 },
  score: { fontVariant: ['tabular-nums'] },
  chip: {
    minWidth: 28,
    paddingHorizontal: spacing['075'],
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: WHITE,
    alignItems: 'center',
  },
  chipWin: { backgroundColor: WHITE },
  chipText: { fontFamily: fontFamily.dynamic, fontSize: 13, color: WHITE },
  chipTextWin: { color: palette.red },
  foot: { gap: spacing['025'] },
  handle: { fontFamily: fontFamily.dynamic, fontSize: 16, color: WHITE },
})
