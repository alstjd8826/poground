import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/** 데이터가 비었을 때. 실패와 구분해서 보여줘야 사용자가 재시도를 헛되이 누르지 않는다. */
export function EmptyState({ title, description }: { title: string; description?: string }) {
  const theme = useTheme()
  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)}
      style={styles.box}
    >
      <Text style={[fonts.headline, { color: theme.textSecondary }]}>{title}</Text>
      {description && (
        <Text style={[fonts.bodySmall, styles.center, { color: theme.textMuted }]}>{description}</Text>
      )}
    </Animated.View>
  )
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const theme = useTheme()
  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.normal).reduceMotion(ReduceMotion.System)}
      style={styles.box}
    >
      <Text style={[fonts.headline, { color: theme.textPrimary }]}>불러오지 못했습니다</Text>
      <Text style={[fonts.bodySmall, styles.center, { color: theme.textMuted }]}>
        {message ?? '네트워크 상태를 확인하고 다시 시도해주세요.'}
      </Text>
      {onRetry && (
        <PressableScale style={[styles.retry, { backgroundColor: theme.accent }]} onPress={onRetry}>
          <Text style={[fonts.label, { color: '#FFFFFF' }]}>다시 시도</Text>
        </PressableScale>
      )}
    </Animated.View>
  )
}

/**
 * 섹션 하나가 비었을 때. 홈처럼 여러 섹션이 한 화면에 쌓이는 곳에서 쓴다.
 *
 * 전체 화면 EmptyState 와 달리 자리를 조금만 차지하고, 카드와 같은 테두리를 둘러
 * "내용이 들어올 자리" 라는 걸 보여준다. 섹션마다 제각각(어디는 문구, 어디는 빈 카드,
 * 어디는 아예 사라짐)이 되지 않게 홈의 모든 섹션이 이걸 쓴다.
 */
export function InlineState({
  message,
  onRetry,
  tone = 'empty',
  busy = false,
}: {
  message: string
  /** 주면 눌러서 다시 불러올 수 있다 */
  onRetry?: () => void
  tone?: 'empty' | 'error'
  /**
   * 다시 불러오는 중. 홈처럼 이 박스가 여러 개 떠 있는 화면에서는 한 번 누르면
   * 전부 이 상태가 되어, 나머지도 같이 갱신된다는 걸 보여준다.
   */
  busy?: boolean
}) {
  const theme = useTheme()
  const color = tone === 'error' ? theme.textSecondary : theme.textMuted
  const box = [styles.inline, { borderColor: theme.border, backgroundColor: theme.surface }]

  const content = (
    <>
      <Text style={[fonts.bodySmall, styles.center, { color }]}>{busy ? '불러오는 중…' : message}</Text>
      {onRetry && !busy && <Text style={[fonts.label, { color: theme.accent }]}>다시 시도</Text>}
      {busy && <ActivityIndicator size="small" color={theme.accent} />}
    </>
  )

  // 진행 중에는 눌러도 아무 일이 없어야 한다. 연타로 요청이 쌓이는 걸 막는다.
  if (onRetry && !busy) {
    return (
      <PressableScale scaleTo={0.99} onPress={onRetry} style={box}>
        {content}
      </PressableScale>
    )
  }

  return <View style={box}>{content}</View>
}

/** 섹션 제목 + 우측 액션. 화면마다 제각각 만들지 않도록 여기로 모은다. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
}) {
  const theme = useTheme()
  return (
    <View style={styles.sectionHeader}>
      <Text style={[fonts.title2, { color: theme.textPrimary }]}>{title}</Text>
      {actionLabel && onAction && (
        <PressableScale scaleTo={0.94} onPress={onAction} style={styles.sectionAction}>
          <Text style={[fonts.label, { color: theme.accent }]}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * 빈 상태·에러는 남은 공간을 스스로 채우고 그 가운데에 선다.
   * flex 없이 padding 만 주면 감싸는 쪽마다 다른 높이에 붙어서,
   * 탭을 옮길 때마다 에러 카드가 위아래로 널뛴다.
   * FlatList 의 ListEmptyComponent 로도 쓰이므로 QueryList 는 contentContainer 에 flexGrow:1 을 준다.
   */
  box: {
    flex: 1,
    paddingVertical: spacing['400'],
    paddingHorizontal: spacing['300'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['100'],
  },
  center: { textAlign: 'center' },
  inline: {
    // 카드 한 장과 비슷한 높이로 잡아 섹션 리듬이 흐트러지지 않게 한다
    minHeight: 88,
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['250'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['100'],
  },
  retry: {
    marginTop: spacing['200'],
    paddingHorizontal: spacing['300'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing['150'],
  },
  sectionAction: { paddingVertical: spacing['050'], paddingLeft: spacing['150'] },
})
