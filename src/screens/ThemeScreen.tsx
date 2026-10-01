import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing, type ThemeKey } from '@/styles'
import { useTheme, useThemeControl } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 테마 고르기.
 *
 * 홈 유니폼(빨강/검정)이 어두운 화면, 원정 유니폼(흰색/빨강)이 밝은 화면이다.
 * 색 이름 대신 유니폼으로 부르는 쪽이 이 앱에서는 더 잘 읽힌다.
 *
 * 2026 시즌 서드킷은 아직 안 나왔다. 그래서 세 번째는 그해 실제로 공개된 세 번째
 * 유니폼인 골키퍼 킷(밝은 노랑 + 하늘색)을 쓴다.
 */
const CHOICES = [
  { key: 'system', label: '단말 설정 따르기', hint: '다크 모드면 홈, 아니면 원정' },
  { key: 'home', label: '홈 유니폼', hint: '빨강 · 어두운 화면' },
  { key: 'away', label: '원정 유니폼', hint: '흰색 · 밝은 화면' },
  // 골키퍼는 다크/라이트에 짝이 없어 '단말 설정 따르기' 로는 안 나온다. 직접 골라야 한다
  { key: 'keeper', label: '골키퍼 유니폼', hint: '노랑 · 어두운 화면' },
] as const

/** 지금 고른 것의 이름. 마이 페이지 줄 오른쪽에 미리 보여 준다 */
export function themeChoiceLabel(preference: ThemeKey | 'system'): string {
  return CHOICES.find(c => c.key === preference)?.label ?? ''
}

export function ThemeScreen() {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { preference, setPreference } = useThemeControl()

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        {CHOICES.map(choice => {
          const selected = preference === choice.key
          return (
            <PressableScale
              key={choice.key}
              scaleTo={0.98}
              onPress={() => setPreference(choice.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                // 고른 것은 테두리 색으로 표시한다. 체크 표시를 따로 그리지 않아도 읽힌다
                selected && { borderColor: theme.accent },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={[fonts.body, { color: theme.textPrimary }]}>{choice.label}</Text>
                <Text style={[fonts.caption, { color: theme.textMuted }]}>{choice.hint}</Text>
              </View>
              {selected && <Text style={[fonts.label, { color: theme.accent }]}>사용 중</Text>}
            </PressableScale>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['300'] },
  section: { gap: spacing['100'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing['150'],
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { gap: 2 },
})
