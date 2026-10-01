import { useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Skeleton } from '@/components/foundation/Skeleton'
import { InlineState } from '@/components/feedback/States'
import { QueryState } from '@/components/feedback/QueryState'
import { CategoryTabs } from '@/components/foundation/CategoryTabs'
import { PlayerPhoto } from '@/components/club/PlayerPhoto'
import { PlayerCardOverlay } from '@/components/club/PlayerCardOverlay'
import { CommentList } from '@/components/comment/CommentList'
import { CommentComposer } from '@/components/comment/CommentComposer'
import type { Comment, CommentSubject } from '@/repositories/comment/remote'
import { usePlayerAppearances } from '@/hooks/query/useKleague'
import { usePlayerPhoto } from '@/hooks/playerPhoto/usePlayerPhotos'
import { type Player, type PlayerAppearance, tallyRecords } from '@/models/kleague'

/** 시즌 합계. 0 인 칸은 숫자를 지워 읽을 것만 남긴다 */
const SEASON_STATS: Array<{ key: keyof Player; label: string }> = [
  { key: 'appearances', label: '출전' },
  { key: 'goals', label: '골' },
  { key: 'assists', label: '도움' },
  { key: 'shots', label: '슈팅' },
  { key: 'fouls', label: '파울' },
  { key: 'yellowCards', label: '경고' },
  { key: 'redCards', label: '퇴장' },
]

function StatGrid({ player }: { player: Player }) {
  const theme = useTheme()
  return (
    <View style={styles.stats}>
      {SEASON_STATS.map(({ key, label }) => {
        const value = player[key] as number
        return (
          <View
            key={label}
            style={[styles.statCell, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text
              style={[fonts.title2, { color: theme.textDisabled }, value > 0 && { color: theme.textPrimary }]}
            >
              {value > 0 ? value : '-'}
            </Text>
            <Text style={[fonts.label, { color: theme.textMuted }]}>{label}</Text>
          </View>
        )
      })}
    </View>
  )
}

function AppearanceRow({ item, index }: { item: PlayerAppearance; index: number }) {
  const theme = useTheme()
  const kickoff = new Date(item.kickoffAtMs)
  const date = `${kickoff.getMonth() + 1}.${kickoff.getDate()}`
  // 같은 기록이 여러 번이면 횟수로 접는다. 한 줄로 늘어놓으면 뒤쪽이 잘려 아예 안 보인다
  const badges = tallyRecords(item.records)

  return (
    <Animated.View
      entering={FadeIn.delay(motion.stagger(index, 20, 10))
        .duration(motion.duration.fast)
        .reduceMotion(ReduceMotion.System)}
      style={[styles.appearance, { borderBottomColor: theme.divider }]}
    >
      <Text style={[fonts.caption, styles.date, { color: theme.textMuted }]}>{date}</Text>

      <View style={styles.matchCell}>
        <View style={styles.matchLine}>
          {/* 홈/원정은 앱의 다른 곳과 같은 말을 쓴다. @ 와 vs 는 아는 사람만 아는 표기다 */}
          <Text style={[fonts.label, { color: theme.textMuted }]}>
            {item.side === 'home' ? '홈' : '원정'}
          </Text>
          <Text style={[fonts.bodySmall, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.opponent}
          </Text>
          {item.substitutedAt !== null && (
            <Text style={[fonts.label, { color: theme.textMuted }]}>{item.substitutedAt}′</Text>
          )}
        </View>

        {/* 기록은 줄바꿈으로 흘린다. 한 줄에 맞추려다 잘리면 그 경기에 무엇을 했는지가 사라진다 */}
        {badges.length > 0 && (
          <View style={styles.badgeRow}>
            {badges.map(({ label, count }) => (
              <View key={label} style={[styles.badge, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[fonts.label, { color: theme.textMuted }]}>
                  {label}
                  {count > 1 ? ` ${count}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text
        style={[
          fonts.label,
          styles.role,
          { color: theme.textMuted },
          item.isStarter && { color: theme.accent },
        ]}
      >
        {item.isStarter ? '선발' : '교체'}
      </Text>
    </Animated.View>
  )
}

export interface PlayerScreenProps {
  player?: Player
  /** 댓글을 쓰려는데 로그인이 안 됐을 때 */
  onRequireLogin?: () => void
}

/**
 * 선수 프로필.
 *
 * 시즌 합계는 스쿼드 API 가, 경기별 기록은 라인업이 준다. 둘을 나란히 두면
 * "몇 골" 만이 아니라 "어느 경기에서" 까지 읽힌다.
 */
/** 처음 보여줄 경기 수. 스무 경기를 한꺼번에 펼치면 프로필이 목록에 묻힌다 */
const PREVIEW = 5

type PlayerTab = 'appearances' | 'comments'

const TABS = [
  { key: 'appearances', label: '출전 기록' },
  { key: 'comments', label: '댓글' },
]

export function PlayerScreen({ player, onRequireLogin }: PlayerScreenProps) {
  const theme = useTheme()
  const appearances = usePlayerAppearances(player?.playerId ?? null)
  // 내가 넣은 사진. 목록에는 안 쓰고 여기와 카드에서만 쓴다
  const myPhoto = usePlayerPhoto(player?.playerId ?? null)
  const cardPlayer = useMemo(() => (player ? { ...player, photoUrl: myPhoto } : undefined), [player, myPhoto])
  const [expanded, setExpanded] = useState(false)
  const toggle = useCallback(() => setExpanded(prev => !prev), [])
  // 카드는 화면을 덮는다. 열려 있는 동안은 프로필을 스크롤하지 않는다
  const [cardOpen, setCardOpen] = useState(false)

  // 카드가 모달이라 덮은 채로 로그인 화면을 밀면 그 뒤에 깔린다. 닫고 나서 민다
  const requireLoginFromCard = useCallback(() => {
    setCardOpen(false)
    onRequireLogin?.()
  }, [onRequireLogin])

  const all = appearances.data ?? []
  const shown = expanded ? all : all.slice(0, PREVIEW)
  const hidden = all.length - shown.length

  /**
   * 댓글 쓰는 자리는 화면 아래에 고정이라 스크롤 **밖**에 있고, 답글 단추는 목록 안에
   * 있다. 둘이 서로 남이므로 "누구에게 답글인지" 는 둘을 모두 품은 여기가 들고 있는다
   * (경기 상세와 같다).
   */
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [dock, setDock] = useState(0)

  // 질의 열쇠가 되므로 렌더마다 새로 만들지 않는다. 새 객체면 목록을 매번 다시 받는다
  const subject = useMemo<CommentSubject>(
    () => ({ type: 'player', id: player?.playerId ?? '' }),
    [player?.playerId],
  )
  /**
   * 기록과 댓글을 한 줄로 이으면 스무 경기를 지나야 댓글이 나온다. 둘은 같이 보는 것이
   * 아니라 번갈아 보는 것이므로 탭으로 가른다 — 경기 상세와 같다.
   */
  const [tab, setTab] = useState<PlayerTab>('appearances')

  // 카드가 덮고 있는 동안에는 쓰는 자리를 감춘다. 카드 위에 바만 떠 있으면 어색하다
  const writing = player != null && !cardOpen && tab === 'comments'

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, writing && { paddingBottom: dock + spacing['200'] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {/* 사진을 누르면 카드가 열린다. 눌러 볼 것이 있다는 걸 눌림 반응으로 알린다 */}
          <PressableScale
            scaleTo={0.96}
            onPress={player ? () => setCardOpen(true) : undefined}
            accessibilityLabel={`${player?.name ?? '선수'} 카드 보기`}
            style={[styles.photoFrame, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <PlayerPhoto uri={myPhoto} style={styles.photo} />
            {/* 넣을 수 있다는 표시. 누르는 곳은 틀 전체다 */}
            {player?.playerId && (
              <View style={[styles.photoBadge, { backgroundColor: theme.accent }]} pointerEvents="none">
                <Text style={[fonts.label, { color: palette.white }]}>+</Text>
              </View>
            )}
          </PressableScale>

          <View style={styles.identity}>
            {player ? (
              <>
                <Text style={[fonts.display, { color: theme.accent }]}>{player.backNo ?? '-'}</Text>
                <Text style={[fonts.title1, { color: theme.textPrimary }]}>{player.name}</Text>
                <Text style={[fonts.bodySmall, { color: theme.textSecondary }]}>
                  {player.position ?? '포지션 미상'}
                </Text>
              </>
            ) : (
              <>
                <Skeleton width={48} height={34} radius={6} />
                <Skeleton width={96} height={22} radius={6} />
                <Skeleton width={40} height={14} radius={4} />
              </>
            )}
          </View>
        </View>

        {player && <StatGrid player={player} />}

        {/* 탭 줄과 그 내용은 한 덩어리다. 사이에 content 의 넓은 간격이 끼면 서로 남처럼 보인다.
            좌우 여백은 content 가 이미 줬으므로 탭 줄에서는 끈다 — 안 그러면 두 번 들어간다 */}
        <View style={styles.tabbed}>
          <CategoryTabs tabs={TABS} value={tab} onChange={key => setTab(key as PlayerTab)} flush />

          {/* 안 보이는 탭도 언마운트하지 않는다. 다시 눌렀을 때 스켈레톤이 또 번쩍이지 않게 */}
          <View style={[styles.section, tab !== 'appearances' && styles.hidden]}>
            <QueryState
              query={appearances}
              skeleton={
                <View style={styles.stack}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} height={40} radius={6} />
                  ))}
                </View>
              }
              empty={data => data.length === 0}
              emptyMessage="아직 출전 기록이 없습니다"
            >
              {() => (
                <View>
                  {shown.map((item, i) => (
                    <AppearanceRow key={item.matchId} item={item} index={i} />
                  ))}
                  {all.length > PREVIEW && (
                    <MoreButton expanded={expanded} hidden={hidden} onPress={toggle} />
                  )}
                </View>
              )}
            </QueryState>
          </View>

          <View style={[styles.section, tab !== 'comments' && styles.hidden]}>
            {player ? (
              <CommentList subject={subject} onReply={setReplyTo} onRequireLogin={onRequireLogin} />
            ) : (
              <InlineState message="선수를 불러오는 중입니다" />
            )}
          </View>
        </View>
      </ScrollView>

      {/* 목록 길이와 무관하게 늘 같은 자리에 둔다 */}
      {writing && (
        <CommentComposer
          subject={subject}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onRequireLogin={onRequireLogin}
          onHeight={setDock}
        />
      )}

      {/* 카드는 프로필 위를 덮는다. 손가락으로 끌어야 하므로 스크롤과 겹치면 안 된다 */}
      <PlayerCardOverlay
        player={cardOpen && cardPlayer ? cardPlayer : null}
        onClose={() => setCardOpen(false)}
        onRequireLogin={requireLoginFromCard}
      />
    </View>
  )
}

/** 펴고 접는 단추. 문구가 상태에 따라 갈려서 조각으로 떼어 둔다 */
function MoreButton({
  expanded,
  hidden,
  onPress,
}: {
  expanded: boolean
  hidden: number
  onPress: () => void
}) {
  const theme = useTheme()
  const label = expanded ? '접기' : `${hidden}경기 더 보기`
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.more, { borderColor: theme.border }]}
      accessibilityLabel={expanded ? '출전 기록 접기' : `출전 기록 ${hidden}경기 더 보기`}
    >
      <Text style={[fonts.label, { color: theme.textSecondary }]}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
  // 탭 줄과 그 내용 사이에는 content 의 넓은 간격을 쓰지 않는다. 한 덩어리로 붙여 둔다
  tabbed: { gap: 0 },
  content: { padding: spacing['200'], gap: spacing['300'], paddingBottom: spacing['800'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['200'] },
  photoFrame: {
    width: 120,
    height: 160,
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    right: spacing['050'],
    bottom: spacing['050'],
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { flex: 1, gap: spacing['050'] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['100'] },
  statCell: {
    flexGrow: 1,
    minWidth: 68,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: spacing['150'] },
  stack: { gap: spacing['100'] },
  appearance: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing['150'],
    paddingVertical: spacing['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  date: { width: 38 },
  matchCell: { flex: 1, gap: spacing['075'] },
  matchLine: { flexDirection: 'row', alignItems: 'center', gap: spacing['075'] },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['050'] },
  badge: { paddingHorizontal: spacing['075'], paddingVertical: 1, borderRadius: cornerRadius['050'] },
  role: { width: 30, textAlign: 'center' },
  more: {
    alignSelf: 'center',
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
