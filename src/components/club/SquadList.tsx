import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Skeleton } from '@/components/foundation/Skeleton'
import { PlayerPhoto } from './PlayerPhoto'
import type { Player } from '@/models/kleague'

/** 기록이 0인 칸은 숫자를 지운다. 0 이 늘어서면 읽을 게 없는데도 눈이 걸린다 */
function Stat({ value }: { value: number }) {
  const theme = useTheme()
  return (
    <Text
      style={[
        fonts.numericSmall,
        styles.stat,
        { color: theme.textDisabled },
        value > 0 && { color: theme.textPrimary },
      ]}
    >
      {value > 0 ? value : '-'}
    </Text>
  )
}

/**
 * 포지션 묶음의 머리글. 위에 고정된다.
 *
 * 포지션과 기록 라벨을 한 줄에 함께 둔다. 둘을 따로 고정하면 스크롤할 때 두 줄이 같은
 * 자리에 겹친다. 합쳐 두면 어느 묶음을 보고 있는지와 각 숫자가 무엇인지가 늘 같이 보인다.
 * 뒤 내용이 비쳐 보이지 않게 페이지와 같은 색을 깔아야 한다.
 */
export function SquadGroupHeader({ position }: { position: string | null }) {
  const theme = useTheme()
  const c = { color: theme.textMuted }
  return (
    <View
      style={[
        styles.row,
        styles.groupHeader,
        { backgroundColor: theme.background, borderBottomColor: theme.divider },
      ]}
    >
      <View style={styles.backNoSlot} />
      <Text style={[fonts.label, styles.nameCell, { color: theme.textSecondary }]}>{position ?? '기타'}</Text>
      <Text style={[fonts.label, styles.stat, c]}>출전</Text>
      <Text style={[fonts.label, styles.stat, c]}>골</Text>
      <Text style={[fonts.label, styles.stat, c]}>도움</Text>
    </View>
  )
}

export const SquadRow = memo(function SquadRow({
  player,
  index,
  onPress,
}: {
  player: Player
  index: number
  onPress?: (player: Player) => void
}) {
  const theme = useTheme()

  return (
    <Animated.View
      entering={FadeIn.delay(motion.stagger(index, 20, 14))
        .duration(motion.duration.fast)
        .reduceMotion(ReduceMotion.System)}
    >
      <PressableScale
        scaleTo={0.99}
        onPress={onPress ? () => onPress(player) : undefined}
        style={[styles.row, { borderBottomColor: theme.divider }]}
        accessibilityLabel={`${player.name} 프로필`}
      >
        <Text style={[fonts.numeric, styles.backNo, { color: theme.textMuted }]}>{player.backNo ?? '-'}</Text>

        {/* 얼굴이 이름보다 빨리 읽힌다. 사진이 없는 선수는 같은 크기의 실루엣이 자리를 지킨다 */}
        <PlayerPhoto uri={player.photoUrl} style={[styles.photo, { backgroundColor: theme.skeleton }]} />

        {/* 포지션은 묶음 머리글이 이미 말해 준다. 줄마다 붙이면 같은 말이 두 번이다 */}
        <Text style={[fonts.bodySmall, styles.nameCell, { color: theme.textPrimary }]} numberOfLines={1}>
          {player.name}
        </Text>

        <Stat value={player.appearances} />
        <Stat value={player.goals} />
        <Stat value={player.assists} />
      </PressableScale>
    </Animated.View>
  )
})

export function SquadRowSkeleton() {
  const theme = useTheme()
  return (
    <View style={[styles.row, { borderBottomColor: theme.divider }]}>
      <View style={styles.backNoSlot}>
        <Skeleton width={18} height={16} radius={4} />
      </View>
      <Skeleton width={30} height={40} radius={6} />
      <View style={styles.nameCell}>
        <Skeleton width={72} height={14} radius={4} />
      </View>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.stat, styles.statSlot]}>
          <Skeleton width={16} height={14} radius={4} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * 좌우 여백이 없다.
   *
   * FlashList 는 고정된 머리글을 contentContainer 바깥의 별도 겹에 그려서, 여백을 어디에
   * 두든 붙었을 때와 아닐 때가 어긋나기 쉽다. 아예 없애면 어긋날 여백 자체가 없다.
   * 화면 가장자리와의 거리는 목록을 감싼 화면이 한 번만 준다.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing['150'],
    paddingVertical: spacing['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backNo: { width: 32, textAlign: 'center' },
  // 실제 사진과 같은 3:4. 얼굴이 담기는 최소한의 크기로 잡았다
  photo: { width: 30, height: 40, borderRadius: 6 },
  backNoSlot: { width: 32, alignItems: 'center' },
  nameCell: { flex: 1 },
  stat: { width: 40, textAlign: 'center' },
  statSlot: { alignItems: 'center' },
  groupHeader: { paddingVertical: spacing['100'] },
})
