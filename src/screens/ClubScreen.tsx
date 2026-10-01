import { useCallback, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { FlashListRef } from '@shopify/flash-list'
import { Image } from 'expo-image'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useTabScrollTop } from '@/hooks/useTabScrollTop'
import { PressableScale } from '@/components/foundation/PressableScale'
import { openExternal } from '@/utils/openExternal'
import { QueryList } from '@/components/foundation/QueryList'
import { SquadGroupHeader, SquadRow, SquadRowSkeleton } from '@/components/club/SquadList'
import { useClubs, useHeadCoach, useSquad } from '@/hooks/query/useKleague'
import { type Club, POHANG, type Player } from '@/models/kleague'

/** 목록에 섞어 넣는 포지션 머리글. 같은 FlashList 안에서 다루려고 한 벌로 묶는다 */
type SquadItem = { kind: 'header'; position: string | null } | { kind: 'player'; player: Player }

function withGroupHeaders(players: Player[] | undefined): SquadItem[] {
  const out: SquadItem[] = []
  let current: string | null | undefined
  for (const player of players ?? []) {
    if (player.position !== current) {
      current = player.position
      out.push({ kind: 'header', position: player.position })
    }
    out.push({ kind: 'player', player })
  }
  return out
}

/** 구단이 공개한 채널. 수집된 것만 보여준다 */
const LINKS: Array<{ key: keyof Club; label: string }> = [
  { key: 'homepage', label: '홈페이지' },
  { key: 'youtubeChannelId', label: '유튜브' },
  { key: 'instagramUrl', label: '인스타그램' },
  { key: 'facebookUrl', label: '페이스북' },
  { key: 'twitterUrl', label: 'X' },
]

function ClubLinks({ club }: { club: Club }) {
  const theme = useTheme()
  const open = useCallback((url: string, label: string) => openExternal(url, label), [])

  const items = LINKS.map(({ key, label }) => {
    const raw = club[key]
    if (!raw || typeof raw !== 'string') return null
    // 유튜브는 채널 ID 만 수집돼 있어 주소로 되돌린다
    const url = key === 'youtubeChannelId' ? `https://www.youtube.com/channel/${raw}` : raw
    return { label, url }
  }).filter((x): x is { label: string; url: string } => x !== null)

  if (items.length === 0) return null

  return (
    <View style={styles.links}>
      {items.map(item => (
        <PressableScale
          key={item.label}
          style={[styles.link, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => open(item.url, item.label)}
          accessibilityLabel={`${item.label} 열기`}
        >
          <Text style={[fonts.label, { color: theme.textSecondary }]}>{item.label}</Text>
        </PressableScale>
      ))}
    </View>
  )
}

/**
 * 구단 머리말.
 *
 * 지금까지는 선수단부터 바로 나와서 무슨 탭인지 알려주는 것이 없었다. 엠블럼과 이름,
 * 그리고 지금 감독을 얹는다. 감독은 따로 모은 표가 없어 가장 최근 경기에서 끌어온다.
 */
function ClubHeader({ club, coach }: { club: Club; coach: string | null }) {
  const theme = useTheme()
  return (
    <View style={styles.header}>
      <Image
        source={{ uri: club.emblemUrl ?? undefined }}
        style={styles.emblem}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
      <View style={styles.identity}>
        <Text style={[fonts.title2, { color: theme.textPrimary }]}>{club.name}</Text>
        {coach && <Text style={[fonts.bodySmall, { color: theme.textSecondary }]}>감독 {coach}</Text>}
      </View>
    </View>
  )
}

/**
 * 구단 탭.
 *
 * 선수단이 주인공이고 구단 채널은 그 아래 덧붙인다. 스쿼드 API 는 등번호와 포지션을 주지 않아
 * 서비스가 라인업에서 끌어와 채우므로, 여기서는 이미 포지션 순으로 정렬된 목록만 받는다.
 */
export interface ClubScreenProps {
  onOpenPlayer?: (player: Player) => void
}

export function ClubScreen({ onOpenPlayer }: ClubScreenProps) {
  // 하단 탭을 다시 누르면 맨 위로
  const listRef = useTabScrollTop<FlashListRef<SquadItem>>()
  const theme = useTheme()
  const squad = useSquad()
  const clubs = useClubs()
  const coach = useHeadCoach()
  const ours = clubs.data?.find(c => c.teamId === POHANG)

  const items = useMemo(() => withGroupHeaders(squad.data), [squad.data])
  const listQuery = useMemo(() => ({ ...squad, data: items }), [squad, items])
  // 포지션 머리글을 위에 고정한다. 목록이 서른일곱 줄이라 어느 묶음을 보는지 놓치기 쉽다
  const stickyIndices = useMemo(
    () => items.map((item, i) => (item.kind === 'header' ? i : -1)).filter(i => i >= 0),
    [items],
  )

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <QueryList
        listRef={listRef}
        query={listQuery}
        keyExtractor={(item, i) => (item.kind === 'header' ? `h-${item.position}-${i}` : item.player.name)}
        renderItem={({ item, index }) =>
          item.kind === 'header' ? (
            <SquadGroupHeader position={item.position} />
          ) : (
            <SquadRow player={item.player} index={index} onPress={onOpenPlayer} />
          )
        }
        stickyHeaderIndices={stickyIndices}
        // 가장자리와의 거리는 바깥 View 가 한 번만 준다. 목록 안쪽에 여백을 두면
        // 고정된 머리글이 그 여백 밖에 그려져 줄과 어긋난다
        contentContainerStyle={styles.list}
        ListHeaderComponent={ours ? <ClubHeader club={ours} coach={coach.data ?? null} /> : null}
        ListFooterComponent={ours ? <ClubLinks club={ours} /> : null}
        ItemSeparatorComponent={null}
        skeleton={<SquadRowSkeleton />}
        skeletonCount={10}
        emptyTitle="선수 정보가 없습니다"
        emptyDescription="시즌이 시작되면 여기에 표시됩니다."
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing['200'] },
  list: { padding: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'], paddingBottom: spacing['200'] },
  emblem: { width: 48, height: 48 },
  identity: { flex: 1, gap: 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['100'], paddingTop: spacing['200'] },
  link: {
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
