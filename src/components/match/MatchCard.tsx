import { memo, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { cornerRadius, fonts, spacing, type Theme } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useAppear } from '@/hooks/useAppear'
import { PressableScale } from '../foundation/PressableScale'
import { Skeleton } from '../foundation/Skeleton'
import {
  isPlayed,
  type Match,
  type MatchOutcome,
  type MatchTeam,
  outcomeOf,
  POHANG,
  sideOf,
} from '@/models/kleague'
import {
  sharedGroup,
  type SharedTag,
  type SharedTransitionStyle,
  useTagScope,
} from '@/utils/sharedTransition'
import { Shared } from '../foundation/Shared'

/**
 * 경기 중일 때 조용히 맥박치는 점. 라이브라는 걸 글자 없이도 알게 한다.
 *
 * 공유 전환 태그를 받아 **안쪽 Animated.View 까지 넘긴다.** Shared 는 감싸지 않고
 * cloneElement 로 props 를 꽂아 주므로, 여기서 받아 넘기지 않으면 태그가 이 컴포넌트에서
 * 멈추고 전환 때 점만 사라진다.
 */
function LivePulse({
  color,
  sharedTransitionTag,
  sharedTransitionStyle,
}: {
  color: string
  sharedTransitionTag?: string
  sharedTransitionStyle?: SharedTransitionStyle
}) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  useEffect(() => {
    const cfg = { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }
    scale.value = withRepeat(withSequence(withTiming(1.5, cfg), withTiming(1, cfg)), -1, false)
    opacity.value = withRepeat(withSequence(withTiming(0.35, cfg), withTiming(1, cfg)), -1, false)
    return () => {
      cancelAnimation(scale)
      cancelAnimation(opacity)
    }
  }, [scale, opacity])

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }))
  return (
    <Animated.View
      sharedTransitionTag={sharedTransitionTag}
      sharedTransitionStyle={sharedTransitionStyle}
      style={[styles.pulse, { backgroundColor: color }, style]}
    />
  )
}

function formatKickoff(d: Date) {
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}.${d.getDate()}(${weekday}) ${hh}:${mm}`
}

/**
 * 승패에 따른 색과 글자.
 *
 * 갈래가 셋이라 한 줄에 이어 붙이면 조건이 겹쳐 무엇이 무엇에 딸린 것인지 안 읽힌다.
 * 이른 반환으로 한 줄에 한 갈래씩 둔다.
 */
function outcomeColorOf(theme: Theme, outcome: MatchOutcome): string {
  if (outcome === 'win') return theme.win
  if (outcome === 'loss') return theme.loss
  if (outcome === 'draw') return theme.draw
  return theme.textMuted
}

function outcomeLabelOf(outcome: MatchOutcome): string {
  if (outcome === 'win') return '승'
  if (outcome === 'loss') return '패'
  return '무'
}

export interface MatchCardProps {
  match: Match
  teamId?: string
  /** 목록에서의 순번. 등장 애니메이션을 계단식으로 밀어준다 */
  index?: number
  /**
   * 켜면 카드가 통째로 다음 화면으로 이어진다.
   * 태그에 경기 ID 가 들어가므로 목록에 여러 장 깔려도 부딪히지 않는다 —
   * 같은 경기가 한 화면에 두 번 나오는 자리에서만 꺼야 한다.
   */
  shared?: boolean
  /**
   * 화면 폭을 꽉 채운다. 상세 헤더처럼 카드가 화면에 박히는 자리에서 쓴다.
   * 좌우가 잘려 나가므로 모서리와 옆 테두리를 없앤다 — 안 그러면 둥근 귀가 화면 끝에 떠 있다.
   */
  flush?: boolean
  onPress?: (match: Match) => void
}

export const MatchCard = memo(function MatchCard({
  match,
  teamId = POHANG,
  index = 0,
  shared = false,
  flush = false,
  onPress,
}: MatchCardProps) {
  const theme = useTheme()
  const side = sideOf(match, teamId)
  const outcome = outcomeOf(match, teamId)
  const played = isPlayed(match)

  const outcomeColor = outcomeColorOf(theme, outcome)

  // 카드를 이루는 조각마다 태그가 필요하다. 카드 면에만 붙이면 빈 상자가 날아간다
  // 범위를 앞에 붙여 다른 탭의 같은 경기와 태그가 겹치지 않게 한다
  const scope = useTagScope()
  const sharedTag = sharedGroup(`${scope}-match`, match.id, shared)
  const appear = useAppear(index, match.id)

  return (
    // 등장은 레이아웃 애니메이션이 아니라 스타일로 — FlashList 안에서 안드로이드가 자리를 붙잡았다 (useAppear)
    <Animated.View style={appear}>
      {/* 카드 면 자체가 태그를 갖는다. 배경·테두리·모서리를 그리는 뷰라야 날아가는 게 보인다 */}
      <Shared tag={sharedTag('card')}>
        <PressableScale
          style={[
            styles.card,
            flush && styles.cardFlush,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={onPress ? () => onPress(match) : undefined}
          accessibilityLabel={`${match.home.name} 대 ${match.away.name} 경기`}
        >
          {/* 결과를 왼쪽 띠로 표시한다. 색만으로 승패를 알 수 있게 하되 아래 텍스트로도 중복 제공 */}
          <Shared tag={sharedTag('stripe')}>
            <Animated.View
              style={[
                styles.stripe,
                { backgroundColor: theme.border },
                played && { backgroundColor: outcomeColor },
              ]}
            />
          </Shared>

          <View style={styles.body}>
            <View style={styles.metaRow}>
              <Shared tag={sharedTag('meta')}>
                <Animated.Text style={[fonts.caption, { color: theme.textMuted }]}>
                  {match.round ? `${match.round}R · ` : ''}
                  {side === 'home' ? '홈' : '원정'}
                </Animated.Text>
              </Shared>
              {match.status === 'live' && (
                /* 감싸는 뷰가 아니라 점과 글자에 각각 붙인다. 껍데기에 붙이면 아무것도
                   그리지 않는 빈 상자가 날아가고 안쪽은 그대로 사라진다 */
                <View style={styles.liveBadge}>
                  <Shared tag={sharedTag('live-dot')}>
                    <LivePulse color={theme.loss} />
                  </Shared>
                  <Shared tag={sharedTag('live-label')}>
                    <Animated.Text style={[fonts.label, { color: theme.loss }]}>LIVE</Animated.Text>
                  </Shared>
                </View>
              )}
              {/* 라이브는 그 자리를 배지가 쓰므로 비운다. 나머지는 끝난 경기도 날짜를 보여준다 —
                  일정 목록에서 달을 훑을 때 날짜가 없으면 어느 경기인지 읽히지 않는다 */}
              {match.status !== 'live' && (
                <Shared tag={sharedTag('kickoff')}>
                  <Animated.Text style={[fonts.caption, { color: theme.textMuted }]}>
                    {formatKickoff(new Date(match.kickoffAtMs))}
                  </Animated.Text>
                </Shared>
              )}
            </View>

            <View style={styles.scoreRow}>
              <TeamSlot team={match.home} align="flex-start" sharedTag={sharedTag} side="home" />

              <View style={styles.scoreBox}>
                {/*
                  스코어는 세 조각이다. 글자 안에 글자를 품으면(가운데 ':' 만 다른 색) 공유 전환이
                  태그 붙은 글자를 자식 없이 복제할 때 안쪽이 따라오지 않는다 — 끝난 경기 카드만
                  전환이 어긋났다 (2026-09-29)
                */}
                {played ? (
                  <View
                    style={styles.score}
                    accessible
                    accessibilityLabel={`${match.home.goal} 대 ${match.away.goal}`}
                  >
                    <Shared tag={sharedTag('score-home')}>
                      <Animated.Text style={[fonts.title1, { color: theme.textPrimary }]}>
                        {String(match.home.goal)}
                      </Animated.Text>
                    </Shared>
                    <Shared tag={sharedTag('score-colon')}>
                      <Animated.Text style={[fonts.title1, { color: theme.textMuted }]}>:</Animated.Text>
                    </Shared>
                    <Shared tag={sharedTag('score-away')}>
                      <Animated.Text style={[fonts.title1, { color: theme.textPrimary }]}>
                        {String(match.away.goal)}
                      </Animated.Text>
                    </Shared>
                  </View>
                ) : (
                  <Shared tag={sharedTag('score')}>
                    <Animated.Text style={[fonts.headline, { color: theme.textMuted }]}>VS</Animated.Text>
                  </Shared>
                )}
              </View>

              <TeamSlot team={match.away} align="flex-end" sharedTag={sharedTag} side="away" />
            </View>

            <View style={styles.footerRow}>
              <Shared tag={sharedTag('stadium')}>
                <Animated.Text style={[fonts.caption, { color: theme.textMuted }]} numberOfLines={1}>
                  {match.stadium ?? ''}
                </Animated.Text>
              </Shared>
              {played && outcome && (
                <Shared tag={sharedTag('outcome')}>
                  <Animated.Text style={[fonts.label, { color: outcomeColor }]}>
                    {outcomeLabelOf(outcome)}
                  </Animated.Text>
                </Shared>
              )}
            </View>
          </View>
        </PressableScale>
      </Shared>
    </Animated.View>
  )
})

/** 엠블럼과 이름은 한 자리에 붙어 다니므로 도장과 자리 이름만 받는다 */
function TeamSlot({
  team,
  align,
  sharedTag,
  side,
}: {
  team: MatchTeam
  align: 'flex-start' | 'flex-end'
  sharedTag: SharedTag
  side: 'home' | 'away'
}) {
  const theme = useTheme()
  return (
    <View style={[styles.teamSlot, { alignItems: align }]}>
      <Shared tag={sharedTag(`${side}-emblem`)}>
        <Animated.Image source={{ uri: team.emblemUrl }} style={styles.emblem} resizeMode="contain" />
      </Shared>
      <Shared tag={sharedTag(`${side}-name`)}>
        <Animated.Text style={[fonts.bodySmall, { color: theme.textPrimary }]} numberOfLines={1}>
          {team.name}
        </Animated.Text>
      </Shared>
    </View>
  )
}

/** 로딩 자리표시자. 실제 카드와 높이가 같아야 데이터가 들어올 때 목록이 튀지 않는다. */
export function MatchCardSkeleton({ flush = false }: { flush?: boolean } = {}) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        flush && styles.cardFlush,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: theme.border }]} />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Skeleton width={64} height={12} radius={4} />
          <Skeleton width={72} height={12} radius={4} />
        </View>
        <View style={styles.scoreRow}>
          <View style={[styles.teamSlot, { alignItems: 'flex-start' }]}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width={52} height={13} radius={4} />
          </View>
          <Skeleton width={56} height={30} radius={6} />
          <View style={[styles.teamSlot, { alignItems: 'flex-end' }]}>
            <Skeleton width={36} height={36} radius={18} />
            <Skeleton width={52} height={13} radius={4} />
          </View>
        </View>
        <View style={styles.footerRow}>
          <Skeleton width={90} height={12} radius={4} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: cornerRadius['200'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  /** 좌우가 화면 밖으로 나가는 자리. 둥근 모서리와 옆 테두리는 보이지 않으니 지운다 */
  cardFlush: { borderRadius: 0, borderLeftWidth: 0, borderRightWidth: 0 },
  stripe: { width: 4 },
  body: { flex: 1, padding: spacing['200'], gap: spacing['150'] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing['075'] },
  pulse: { width: 6, height: 6, borderRadius: 3 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  teamSlot: { flex: 1, gap: spacing['075'] },
  emblem: { width: 36, height: 36 },
  /** 원래 한 줄 글자의 빈칸 한 칸만큼 띄운다 */
  score: { flexDirection: 'row', alignItems: 'baseline', gap: spacing['075'] },
  scoreBox: { paddingHorizontal: spacing['150'], minWidth: 88, alignItems: 'center' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
