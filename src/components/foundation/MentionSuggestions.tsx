import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Avatar } from '@/components/profile/Avatar'
import { type HandleCandidate, searchHandles } from '@/repositories/profile/search'

/** 치는 동안 묻지 않고 잠깐 기다린다. 한 글자마다 묻지 않되 느리다고 느끼지 않을 만큼 */
const DEBOUNCE_MS = 150

/**
 * 치는 중인 언급의 후보. 글자를 칠 때마다 앞부분으로 찾는다 (2026-09-29).
 *
 * 늦게 도착한 옛 답은 버린다 — `st` 의 답이 `ste` 의 답보다 늦게 오면 목록이 거꾸로 돌아간다.
 * 못 찾았거나 실패하면 아무것도 띄우지 않는다. 후보는 곁가지라 쓰는 일을 막으면 안 된다.
 */
export function useHandleSearch(query: string | null): HandleCandidate[] {
  const [found, setFound] = useState<HandleCandidate[]>([])
  useEffect(() => {
    if (!query) {
      setFound([])
      return
    }
    let alive = true
    const timer = setTimeout(() => {
      searchHandles(query).then(
        rows => alive && setFound(rows),
        () => alive && setFound([]),
      )
    }, DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])
  return query ? found : []
}

export function MentionSuggestions({
  query,
  onPick,
}: {
  /** 치는 중인 @뒤 글자. 없으면 아무것도 띄우지 않는다 */
  query: string | null
  onPick: (handle: string) => void
}) {
  const theme = useTheme()
  const found = useHandleSearch(query)
  if (found.length === 0) return null
  return (
    <View style={[styles.list, { borderColor: theme.divider }]}>
      {found.map(c => (
        <PressableScale
          key={c.id}
          scaleTo={0.98}
          onPress={() => onPick(c.handle)}
          accessibilityRole="button"
          accessibilityLabel={`@${c.handle} 고르기`}
          style={styles.row}
        >
          <Avatar url={c.avatarUrl} size={24} />
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]}>@{c.handle}</Text>
        </PressableScale>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing['050'],
    marginBottom: spacing['050'],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'], paddingVertical: spacing['075'] },
})
