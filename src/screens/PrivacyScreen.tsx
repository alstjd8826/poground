import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PRIVACY_MD } from '@/content/privacy'
import { type Block, inlineParts, parseMarkdown } from '@/utils/markdown'

/**
 * 개인정보 처리방침 (2026-09-30). 원본은 docs/privacy.md — 앱은 그 글을 그대로 싣는다(npm run legal).
 *
 * 표는 폰 폭에 칸을 나란히 두면 글자가 한두 자씩 접힌다. 줄마다 묶음 하나로 풀어, 첫 칸을 이름으로 굵게 두고
 * 나머지 칸은 머리 줄 이름과 함께 아래로 적는다.
 */
export function PrivacyScreen() {
  const theme = useTheme()
  const bottomGap = useBottomSafeGap()
  const blocks = useMemo(() => parseMarkdown(PRIVACY_MD), [])

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
    >
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </ScrollView>
  )
}

function BlockView({ block }: { block: Block }) {
  const theme = useTheme()
  switch (block.type) {
    case 'heading': {
      const font = block.level === 1 ? fonts.title1 : block.level === 2 ? fonts.title2 : fonts.label
      return <Rich text={block.text} style={[font, styles.heading, { color: theme.textPrimary }]} />
    }
    case 'paragraph':
      return <Rich text={block.text} style={[fonts.bodySmall, { color: theme.textSecondary }]} />
    case 'item':
      return (
        <View style={styles.item}>
          <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>•</Text>
          <Rich
            text={block.text}
            style={[fonts.bodySmall, styles.itemText, { color: theme.textSecondary }]}
          />
        </View>
      )
    case 'rule':
      return <View style={[styles.rule, { backgroundColor: theme.divider }]} />
    case 'table':
      return (
        <View style={styles.table}>
          {block.rows.map((row, r) => (
            <View key={r} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Rich text={row[0] ?? ''} style={[fonts.label, { color: theme.textPrimary }]} />
              {row.slice(1).map((cell, c) => (
                <View key={c} style={styles.cell}>
                  <Text style={[fonts.caption, { color: theme.textMuted }]}>{block.header[c + 1]}</Text>
                  <Rich text={cell} style={[fonts.bodySmall, { color: theme.textSecondary }]} />
                </View>
              ))}
            </View>
          ))}
        </View>
      )
  }
}

/** **굵게** 를 풀어 그린다 */
function Rich({ text, style }: { text: string; style: object | object[] }) {
  const parts = inlineParts(text)
  if (parts.length === 1 && !parts[0]!.bold) return <Text style={style}>{parts[0]!.text}</Text>
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <Text key={i} style={part.bold && styles.bold}>
          {part.text}
        </Text>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  heading: { marginTop: spacing['100'] },
  item: { flexDirection: 'row', gap: spacing['075'] },
  itemText: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: spacing['100'] },
  table: { gap: spacing['075'] },
  row: {
    gap: spacing['075'],
    padding: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  cell: { gap: spacing['025'] },
  bold: { fontWeight: '700' },
})
