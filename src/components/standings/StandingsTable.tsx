import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { Skeleton } from '../foundation/Skeleton'
import { POHANG, RANK_TIERS, type RankTier, type Standing, tierOfRank } from '@/models/kleague'

/** 최근 6경기 폼. 색과 글자를 함께 써서 색각 이상에서도 읽힌다. */
export const FormPills = memo(function FormPills({ form }: { form: string[] }) {
  const theme = useTheme()
  const color = (r: string) => {
    if (r === '승') return theme.win
    if (r === '패') return theme.loss
    return theme.draw
  }

  return (
    <View style={styles.pillRow}>
      {form.slice(0, 6).map((r, i) => (
        <Animated.View
          key={`${r}-${i}`}
          entering={FadeIn.delay(i * 40)
            .duration(motion.duration.fast)
            .reduceMotion(ReduceMotion.System)}
          style={[styles.pill, { backgroundColor: color(r) }]}
        >
          <Text style={[fonts.caption, styles.pillText]}>{r}</Text>
        </Animated.View>
      ))}
    </View>
  )
})

/**
 * 숫자 열은 폭을 고정한다. 세로로 읽히는 표라 줄마다 자리가 달라지면 안 된다.
 *
 * 남거나 모자란 폭은 구단 이름 칸이 받는다. 이름은 말줄임이 되므로 좁아져도 표가
 * 무너지지 않는 유일한 칸이다.
 */
const COLS = { rank: 28, played: 36, record: 72, diff: 36, points: 36 }

/** 경기 카드의 결과 띠와 같은 장치. 줄 왼쪽 끝에서 색만으로 등급을 알린다 */
function tierColor(theme: ReturnType<typeof useTheme>, tier: RankTier | null): string | undefined {
  if (tier === 'acle') return theme.rankAcle
  if (tier === 'acl2') return theme.rankAcl2
  if (tier === 'relegation') return theme.rankRelegation
  return undefined
}

/**
 * 순위표 아래 범례.
 *
 * 색만 칠해 두면 파란 줄이 무슨 뜻인지 알 길이 없다. 규정 문구를 그대로 붙여 준다.
 */
export function StandingsLegend() {
  const theme = useTheme()
  return (
    <View style={styles.legend}>
      {RANK_TIERS.map(rule => (
        <View key={rule.tier} style={styles.legendRow}>
          <View style={[styles.legendSwatch, { backgroundColor: tierColor(theme, rule.tier) }]} />
          <Text style={[fonts.caption, styles.legendText, { color: theme.textMuted }]}>{rule.note}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * 승·무·패를 한 덩어리 문자열로 찍으면 줄마다 길이가 달라져 가운뎃점이 제각각 선다.
 * 숫자마다 같은 폭의 칸을 주어 점 위치를 고정한다 — 표는 세로로 읽히므로 이게 훨씬 정돈돼 보인다.
 */
function RecordCell({ win, draw, loss, color }: { win: number; draw: number; loss: number; color: string }) {
  const num = [fonts.numericSmall, styles.recordNum, { color }]
  const dot = [fonts.numericSmall, styles.recordDot, { color }]
  return (
    <View style={[styles.recordCell, { width: COLS.record }]}>
      <Text style={num}>{win}</Text>
      <Text style={dot}>·</Text>
      <Text style={num}>{draw}</Text>
      <Text style={dot}>·</Text>
      <Text style={num}>{loss}</Text>
    </View>
  )
}

function HeaderRow() {
  const theme = useTheme()
  const c = { color: theme.textMuted }
  return (
    <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.divider }]}>
      {/* 행의 띠와 폭을 맞춰 머리글이 밀리지 않게 한다 */}
      <View style={styles.tier} />
      {/* 머리글은 줄바꿈하지 않는다. 두 글자가 쪼개지면 표가 아니라 사고로 보인다 */}
      <Text style={[fonts.caption, c, styles.center, { width: COLS.rank }]} numberOfLines={1}>
        순위
      </Text>
      <Text style={[fonts.caption, c, styles.teamCell]} numberOfLines={1}>
        구단
      </Text>
      <Text style={[fonts.caption, c, styles.playedCell]} numberOfLines={1}>
        경기
      </Text>
      <Text style={[fonts.caption, c, styles.center, { width: COLS.record }]} numberOfLines={1}>
        승무패
      </Text>
      <Text style={[fonts.caption, c, styles.center, { width: COLS.diff }]} numberOfLines={1}>
        득실
      </Text>
      <Text style={[fonts.caption, c, styles.center, { width: COLS.points }]} numberOfLines={1}>
        승점
      </Text>
    </View>
  )
}

export interface StandingRowProps {
  standing: Standing
  index: number
  highlightTeamId?: string
}

export const StandingRow = memo(function StandingRow({
  standing: s,
  index,
  highlightTeamId = POHANG,
}: StandingRowProps) {
  const theme = useTheme()
  const mine = s.teamId === highlightTeamId

  return (
    <Animated.View
      // 가로로 미는 등장은 쓰지 않는다. FlashList 안에서 재활용될 때 translateX 가 남은 채 멈춰
      // 두 자리 순위 줄이 통째로 오른쪽으로 밀린 적이 있다. 자리를 건드리지 않는 페이드만 쓴다.
      entering={FadeIn.delay(motion.stagger(index, 30, 12))
        .duration(motion.duration.normal)
        .reduceMotion(ReduceMotion.System)}
      style={[
        styles.row,
        { borderBottomColor: theme.divider },
        // 우리 팀 줄은 배경으로 집어준다. 스크롤 중에도 눈이 바로 찾는다
        mine && { backgroundColor: theme.accentSoft, borderRadius: cornerRadius['100'] },
      ]}
    >
      <View style={[styles.tier, { backgroundColor: tierColor(theme, tierOfRank(s.rank)) }]} />
      <Text
        style={[
          fonts.numericSmall,
          styles.center,
          { color: theme.textPrimary, width: COLS.rank },
          mine && { color: theme.accent },
        ]}
      >
        {s.rank}
      </Text>
      <Text style={[fonts.bodySmall, styles.teamCell, { color: theme.textPrimary }]} numberOfLines={1}>
        {s.teamName}
      </Text>
      <Text style={[fonts.numericSmall, styles.playedCell, { color: theme.textSecondary }]}>{s.played}</Text>
      <RecordCell win={s.win} draw={s.draw} loss={s.loss} color={theme.textSecondary} />
      <Text style={[fonts.numericSmall, styles.center, { color: theme.textSecondary, width: COLS.diff }]}>
        {s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}
      </Text>
      <Text
        style={[
          fonts.numeric,
          styles.center,
          { color: theme.textPrimary, width: COLS.points },
          mine && { color: theme.accent },
        ]}
      >
        {s.points}
      </Text>
    </Animated.View>
  )
})

export function StandingsTable({
  standings,
  highlightTeamId,
}: {
  standings: Standing[]
  highlightTeamId?: string
}) {
  const theme = useTheme()
  return (
    <View style={[styles.table, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <HeaderRow />
      {standings.map((s, i) => (
        <StandingRow key={s.teamId} standing={s} index={i} highlightTeamId={highlightTeamId} />
      ))}
    </View>
  )
}

/** 표 한 줄짜리 자리표시자. QueryList 의 skeleton 으로 넘긴다. */
export function StandingRowSkeleton() {
  const theme = useTheme()
  return (
    <View style={[styles.row, { borderBottomColor: theme.divider }]}>
      <Skeleton width={18} height={14} radius={4} />
      <View style={styles.teamCell}>
        <Skeleton width={72} height={14} radius={4} />
      </View>
      <Skeleton width={20} height={14} radius={4} style={styles.skelCell} />
      <Skeleton width={52} height={14} radius={4} style={styles.skelCell} />
      <Skeleton width={26} height={14} radius={4} style={styles.skelCell} />
      <Skeleton width={26} height={14} radius={4} style={styles.skelCell} />
    </View>
  )
}

/** 순위표 헤더. 표 안팎 어디서든 같은 폭을 쓰도록 밖으로 뺀다. */
export function StandingsHeaderRow() {
  return <HeaderRow />
}

export function StandingsTableSkeleton({ rows = 12 }: { rows?: number }) {
  const theme = useTheme()
  return (
    <View style={[styles.table, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <HeaderRow />
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, { borderBottomColor: theme.divider }]}>
          <Skeleton width={18} height={14} radius={4} />
          <View style={styles.teamCell}>
            <Skeleton width={72} height={14} radius={4} />
          </View>
          <Skeleton width={20} height={14} radius={4} style={styles.skelCell} />
          <Skeleton width={52} height={14} radius={4} style={styles.skelCell} />
          <Skeleton width={26} height={14} radius={4} style={styles.skelCell} />
          <Skeleton width={26} height={14} radius={4} style={styles.skelCell} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  table: {
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing['150'],
    paddingHorizontal: spacing['100'],
    // 숫자 열끼리 붙으면 "29 19·5·5" 처럼 한 덩어리로 읽힌다. 열 사이를 일정하게 띄운다
    columnGap: spacing['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: { paddingVertical: spacing['100'] },
  /** 등급이 없는 줄에서는 색 없이 자리만 지킨다. 그래야 모든 줄의 숫자가 같은 x 에 선다 */
  tier: { width: 3, alignSelf: 'stretch', borderRadius: cornerRadius['050'] },
  legend: { gap: spacing['100'], paddingTop: spacing['200'] },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['100'] },
  legendSwatch: { width: 8, height: 8, borderRadius: 2, marginTop: 4 },
  legendText: { flex: 1 },
  /**
   * 폭이 모자랄 때 줄어드는 유일한 열.
   *
   * 예전에는 경기 열이 flex 라 완충재였는데, 글자 크기를 키우거나 좁은 화면에 놓으면
   * "경기" 두 글자가 두 줄로 쪼개지고 더 좁아지면 열이 통째로 사라졌다. 줄어들어도 되는
   * 것은 말줄임이 되는 구단명 쪽이다.
   */
  teamCell: { flex: 1, minWidth: 40, textAlign: 'center' },
  playedCell: { width: COLS.played, textAlign: 'center' },
  // 숫자 열은 머리글과 값이 같은 가운데에 선다. 정렬이 열마다 다르면 머리글이 값 위를 벗어난다
  center: { textAlign: 'center' },
  recordCell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  recordNum: { width: 18, textAlign: 'center' },
  recordDot: { width: 6, textAlign: 'center' },
  skelCell: { marginLeft: spacing['100'] },
  pillRow: { flexDirection: 'row', gap: spacing['050'] },
  pill: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
})
