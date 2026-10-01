import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { Skeleton } from '@/components/foundation/Skeleton'
import { cardOf, type CardKind, type LineupPlayer, recordTally, type TeamLineup } from '@/models/kleague'

/**
 * 경고·퇴장만 색을 준다.
 * 나머지 뱃지(파울·유효슈팅 등)는 수가 많아 전부 색을 주면 줄이 알록달록해져 읽기 어렵다.
 */
/**
 * 카드 표시.
 *
 * 누적 퇴장은 노란 카드 위에 빨간 카드를 살짝 어긋나게 겹쳐 그린다. 중계 그래픽이 쓰는
 * 모양이라 축구 팬이면 설명 없이 읽는다. 빨강 한 장으로 뭉뚱그리면 스트레이트 레드와
 * 구분이 안 되고, "왜 나갔는지" 가 사라진다.
 */
function CardMark({ kind }: { kind: CardKind }) {
  const theme = useTheme()
  if (kind === '누적 퇴장') {
    return (
      <View style={styles.stackedCards} accessibilityLabel={kind}>
        <View style={[styles.card, { backgroundColor: theme.cardYellow }]} />
        <View style={[styles.card, styles.cardOnTop, { backgroundColor: theme.cardRed }]} />
      </View>
    )
  }
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardYellow },
        kind === '퇴장' && { backgroundColor: theme.cardRed },
      ]}
      // 색만으로 구분되므로 읽어 주는 이름을 붙인다
      accessibilityLabel={kind}
    />
  )
}

function RecordBadges({ player }: { player: LineupPlayer }) {
  const theme = useTheme()
  const card = cardOf(player)
  const tally = recordTally(player)

  return (
    <View style={styles.badgeRow}>
      {card && <CardMark kind={card} />}
      {tally.map(({ label, count }) => (
        <View key={label} style={[styles.badge, { backgroundColor: theme.surfaceElevated }]}>
          <Text style={[fonts.label, { color: theme.textMuted }]}>
            {label}
            {count > 1 ? ` ${count}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}

const PlayerRow = memo(function PlayerRow({ player, index }: { player: LineupPlayer; index: number }) {
  const theme = useTheme()

  return (
    <Animated.View
      entering={FadeIn.delay(motion.stagger(index, 20, 14))
        .duration(motion.duration.fast)
        .reduceMotion(ReduceMotion.System)}
      style={styles.row}
    >
      <Text style={[fonts.numericSmall, styles.backNo, { color: theme.textMuted }]}>
        {player.backNo ?? '-'}
      </Text>

      <View style={styles.nameCell}>
        <View style={styles.nameRow}>
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]} numberOfLines={1}>
            {player.name}
          </Text>
          {player.isCaptain && (
            <View style={[styles.captain, { borderColor: theme.accent }]}>
              <Text style={[fonts.label, { color: theme.accent, fontSize: 9 }]}>C</Text>
            </View>
          )}
        </View>
        {player.substitutedAt !== null && (
          <Text style={[fonts.caption, { color: theme.textMuted }]} numberOfLines={1}>
            {player.substitutedAt}′{player.substitutedWith ? ` · ${player.substitutedWith}` : ''}
          </Text>
        )}
      </View>

      <RecordBadges player={player} />

      <Text style={[fonts.label, styles.position, { color: theme.textMuted }]}>{player.position ?? ''}</Text>
    </Animated.View>
  )
})

function Group({ title, players, offset }: { title: string; players: LineupPlayer[]; offset: number }) {
  const theme = useTheme()
  if (players.length === 0) return null
  return (
    <View style={styles.group}>
      <Text style={[fonts.label, { color: theme.textMuted }]}>{title}</Text>
      {players.map((p, i) => (
        <PlayerRow key={p.playerId} player={p} index={offset + i} />
      ))}
    </View>
  )
}

/** 한 팀의 라인업. 선발 -> 교체 명단 -> 감독 순서로 읽힌다. */
export function LineupList({ team }: { team: TeamLineup }) {
  const theme = useTheme()

  return (
    <View style={styles.list}>
      <Group title="선발" players={team.starters} offset={0} />
      <Group title="교체 명단" players={team.bench} offset={team.starters.length} />
      {team.coach && (
        <View style={[styles.coach, { borderTopColor: theme.divider }]}>
          <Text style={[fonts.label, { color: theme.textMuted }]}>감독</Text>
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>{team.coach}</Text>
        </View>
      )}
    </View>
  )
}

/**
 * 로딩 자리표시자.
 *
 * 실제 줄과 **같은 스타일**을 쓴다. 폭만 비슷하게 흉내 내면 등번호와 포지션이 칸을 벗어나
 * 데이터가 들어올 때 좌우로 흔들린다. 이름 폭만 조금씩 달리해 막대가 줄지어 보이지 않게 한다.
 */
const NAME_WIDTHS = [68, 56, 78, 62, 72, 58, 80, 64, 70, 60, 74]

export function LineupListSkeleton() {
  return (
    <View style={styles.list}>
      <View style={styles.group}>
        <Skeleton width={28} height={12} radius={4} />
        {NAME_WIDTHS.map((w, i) => (
          <View key={i} style={styles.row}>
            <View style={styles.backNoSlot}>
              <Skeleton width={16} height={13} radius={4} />
            </View>
            <View style={styles.nameCell}>
              <Skeleton width={w} height={14} radius={4} />
            </View>
            <View style={styles.positionSlot}>
              <Skeleton width={20} height={12} radius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing['200'] },
  group: { gap: spacing['100'] },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: spacing['150'], minHeight: 34 },
  backNo: { width: 24, textAlign: 'right' },
  nameCell: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['075'] },
  captain: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: cornerRadius['050'],
    paddingHorizontal: 3,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['050'] },
  // 경고/퇴장은 글자 없이 카드 모양으로. 축구 팬에게는 색만으로 바로 읽힌다.
  // 노랑이 흰 배경에서 묻히지 않게 아주 옅은 테두리를 둘러 둔다
  card: {
    width: 9,
    height: 12,
    borderRadius: 1.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  /** 두 장을 겹쳐 놓을 자리. 위 카드가 밖으로 삐져나오는 만큼만 넓힌다 */
  stackedCards: { width: 14, height: 12 },
  cardOnTop: { position: 'absolute', left: 5, top: 0 },
  badge: { paddingHorizontal: spacing['075'], paddingVertical: 1, borderRadius: cornerRadius['050'] },
  position: { width: 26, textAlign: 'right' },
  // 자리표시자를 실제 칸과 같은 폭으로 잡아 둔다. 오른쪽 정렬까지 맞춰야 흔들리지 않는다
  backNoSlot: { width: 24, alignItems: 'flex-end' },
  positionSlot: { width: 26, alignItems: 'flex-end' },
  coach: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['150'],
  },
})
