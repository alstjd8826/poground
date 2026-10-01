import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useAppear } from '@/hooks/useAppear'
import { PressableScale } from '../foundation/PressableScale'
import { Skeleton } from '../foundation/Skeleton'
import type { NewsArticle } from '@/models/kleague'

const CATEGORY_LABEL: Record<string, string> = {
  club: '구단',
  league: '리그',
  notice: '공지',
  fan: '팬',
  youth: '유스',
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

export interface NewsCardProps {
  article: NewsArticle
  index?: number
  onPress?: (article: NewsArticle) => void
}

export const NewsCard = memo(function NewsCard({ article, index = 0, onPress }: NewsCardProps) {
  const theme = useTheme()
  const mine = article.clubTag === '포항'
  const appear = useAppear(index, article.id)

  return (
    // 등장은 레이아웃 애니메이션이 아니라 스타일로 — FlashList 안에서 안드로이드가 자리를 붙잡았다 (useAppear)
    <Animated.View style={appear}>
      <PressableScale
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onPress={onPress ? () => onPress(article) : undefined}
        accessibilityLabel={article.title}
      >
        {/* 사진은 걸지 않는다. K리그 사진을 우리 버킷에 복제하는 것도, 원본(장당 최대 4.5MB)을
            바로 거는 것도 하지 않는다. 읽는 것은 원문에서 한다 */}
        <View style={styles.content}>
          <View style={styles.badgeRow}>
            {mine && (
              // 카드가 통째로 흐리게 나타나므로 배지를 따로 페이드하지 않는다 (FlashList 안 entering 금지, useAppear)
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <Text style={[fonts.caption, { color: '#FFFFFF' }]}>포항</Text>
              </View>
            )}
            {article.category && (
              <Text style={[fonts.caption, { color: theme.textMuted }]}>
                {CATEGORY_LABEL[article.category] ?? article.category}
              </Text>
            )}
            <Text style={[fonts.caption, { color: theme.textMuted }]}>
              · {formatDate(article.publishedOn)}
            </Text>
          </View>

          <Text style={[fonts.body, { color: theme.textPrimary }]} numberOfLines={2}>
            {article.title}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  )
})

export function NewsCardSkeleton() {
  const theme = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.content}>
        <Skeleton width={96} height={12} radius={4} />
        <Skeleton width="100%" height={15} radius={4} />
        <Skeleton width="70%" height={15} radius={4} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing['150'],
    padding: spacing['150'],
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1, gap: spacing['075'], justifyContent: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['075'] },
  badge: { paddingHorizontal: spacing['100'], paddingVertical: 2, borderRadius: cornerRadius.full },
})
