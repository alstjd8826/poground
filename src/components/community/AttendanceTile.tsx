import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Rect } from 'react-native-svg'

import { fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import type { Theme } from '@/styles/colors/theme'
import { PressableScale } from '@/components/foundation/PressableScale'
import { LockIcon } from '@/components/community/LockIcon'
import { usePostPhoto } from '@/hooks/community/useCommunity'
import type { TimelineItem } from '@/models/attendance'
import type { Post } from '@/models/community'
import { type Match, opponentOf, outcomeOf, ourTeam } from '@/models/kleague'

const OUTCOME = { win: '승', draw: '무', loss: '패' } as const

/** 사진 위에 얹는 스코어의 결과 색 비침. 사진이 보이되 승패 색은 읽히게 */
const OVERLAY = 0.45

/** 글 칸의 이름. 태그를 뺀 본문 첫 줄 — 태그뿐이면 #직관 */
export function tileTitle(post: Post): string {
  const line =
    post.body
      .split('\n')
      .map(l => l.replace(/#[^\s#]+/g, '').trim())
      .find(l => l.length > 0) ?? ''
  return line || '#직관'
}

/**
 * 직관 기록 격자의 한 칸 (2026-09-29, 3열). 인스타그램 프로필처럼 모아 보는 자리다.
 *
 * 글 칸: 사진이 있으면 첫 장, 없으면 경기 스코어(경기가 붙은 글) 또는 본문 첫 줄. 사진이 여러 장이면
 * 겹친 네모, 나만 보기면 자물쇠. 누르면 글로 — 좋아요·수정은 상세에서 한다.
 * 경기 칸: 글 없이 체크만 한 경기. 옅은 바탕에 스코어와 +, 누르면 그 경기로 글쓰기.
 */
export function AttendanceTile({
  item,
  size,
  onOpenPost,
  onWritePost,
}: {
  item: TimelineItem
  size: number
  onOpenPost?: (post: Post) => void
  onWritePost?: (match: Match) => void
}) {
  if (item.kind === 'post') {
    return <PostTile post={item.post} match={item.match} size={size} onOpen={onOpenPost} />
  }
  const { match } = item.entry
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={onWritePost ? () => onWritePost(match) : undefined}
      accessibilityRole="button"
      accessibilityLabel="이 경기 글 쓰기"
    >
      <EmptyMatch match={match} size={size} />
    </PressableScale>
  )
}

function PostTile({
  post,
  match,
  size,
  onOpen,
}: {
  post: Post
  match: Match | undefined
  size: number
  onOpen?: (post: Post) => void
}) {
  const theme = useTheme()
  const cover = usePostPhoto(post, post.photos[0]?.position ?? 0)
  const hasPhoto = post.photos.length > 0
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={onOpen ? () => onOpen(post) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`글 열기: ${tileTitle(post)}`}
    >
      <View style={[styles.tile, { width: size, height: size, backgroundColor: theme.skeleton }]}>
        {hasPhoto ? (
          cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : match ? (
          <Score match={match} />
        ) : (
          <Words post={post} />
        )}
        {/* 사진 칸에도 사진 없는 칸의 스코어를 그대로, 사진 위에 연하게 얹는다 */}
        {hasPhoto && match && <Score match={match} overlay />}
        <View style={styles.badges} pointerEvents="none">
          {post.photos.length > 1 && <ManyPhotos />}
          {post.visibility === 'private' && <LockIcon color={palette.white} />}
        </View>
      </View>
    </PressableScale>
  )
}

/** 바탕이 어두운 테마인가. 글자 칸의 바탕을 짙게 둘지 옅게 둘지 가른다 */
function isDark(theme: Theme): boolean {
  const hex = theme.background.replace('#', '')
  const sum = [0, 2, 4].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0)
  return sum < 384
}

/**
 * 글만 있는 칸의 색 (2026-09-29). 테마 강조색과 그 옅은 바탕(처음 색)에 몇 가지를 더해, 글 id 로 하나를
 * 고른다 — 글마다 늘 같은 색이다. 다시 그릴 때마다 바뀌면 같은 글이 볼 때마다 다른 칸처럼 보인다.
 */
export function tileTone(postId: string, theme: Theme): { quote: string; background: string } {
  let hash = 0
  for (let i = 0; i < postId.length; i += 1) hash = (hash * 31 + postId.charCodeAt(i)) >>> 0
  const pick = hash % (palette.tiles.length + 1)
  if (pick === 0) return { quote: theme.accent, background: theme.accentSoft }
  const tone = palette.tiles[pick - 1]!
  return { quote: tone.strong, background: isDark(theme) ? tone.deep : tone.pale }
}

/**
 * 글만 있는 칸. 텍스트만 덜렁 두면 어색해서(2026-09-29) 옅은 강조색 바탕에 여닫는 따옴표, 가운데 본문
 * 첫 줄, 아래 쓴 날짜를 둔 카드로 그린다. 따옴표는 흔한 글자라 서체에 있다.
 */
function Words({ post }: { post: Post }) {
  const theme = useTheme()
  const tone = tileTone(post.id, theme)
  const d = new Date(post.createdAt)
  return (
    <View style={[StyleSheet.absoluteFill, styles.words, { backgroundColor: tone.background }]}>
      <Text style={[fonts.title1, styles.quote, { color: tone.quote }]}>“</Text>
      <Text style={[fonts.label, styles.wordsBody, { color: theme.textPrimary }]} numberOfLines={3}>
        {tileTitle(post)}
      </Text>
      {/* 날짜 줄 오른쪽 끝에 닫는 따옴표. 위의 여는 따옴표와 짝을 맞춘다 */}
      <View style={styles.wordsFoot}>
        <Text
          style={[fonts.caption, { color: theme.textMuted }]}
        >{`${d.getMonth() + 1}.${d.getDate()}`}</Text>
        <Text style={[fonts.title1, styles.quote, { color: tone.quote }]}>”</Text>
      </View>
    </View>
  )
}

/** 결과 색 바탕에 스코어. 사진 없는 직관 글 칸, 그리고 사진 칸 위(overlay) */
function Score({ match, overlay = false }: { match: Match; overlay?: boolean }) {
  const theme = useTheme()
  const outcome = outcomeOf(match)
  const tone = outcome === 'win' ? theme.accent : outcome === 'loss' ? theme.textPrimary : theme.textMuted
  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      {/* 사진 위에 얹을 때는 결과 색만 반쯤 비치게 — 글자는 또렷이 둔다 */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: tone, opacity: overlay ? OVERLAY : 1 }]}
        accessibilityLabel={overlay ? '스코어 겹침' : undefined}
      />
      <Text style={[fonts.title2, { color: palette.white }]}>{outcome ? OUTCOME[outcome] : '예정'}</Text>
      <Text style={[fonts.caption, { color: palette.white }]} numberOfLines={1}>
        {outcome ? `${ourTeam(match).goal}:${opponentOf(match).goal}` : `vs ${opponentOf(match).name}`}
      </Text>
    </View>
  )
}

/** 글 없이 체크만 한 경기 칸. 옅은 바탕에 스코어와 + */
function EmptyMatch({ match, size }: { match: Match; size: number }) {
  const theme = useTheme()
  const outcome = outcomeOf(match)
  return (
    <View
      style={[
        styles.tile,
        styles.center,
        { width: size, height: size, backgroundColor: theme.surface, borderColor: theme.border },
        styles.outlined,
      ]}
    >
      <Text style={[fonts.title2, { color: theme.accent }]}>+</Text>
      <Text style={[fonts.caption, { color: theme.textMuted }]} numberOfLines={1}>
        {outcome
          ? `${ourTeam(match).goal}:${opponentOf(match).goal} ${OUTCOME[outcome]}`
          : `vs ${opponentOf(match).name}`}
      </Text>
    </View>
  )
}

/** 사진 여러 장 표시. 겹친 네모를 그린다 — 서체 기호에 기대지 않는다 */
function ManyPhotos() {
  return (
    <View accessible accessibilityLabel="사진 여러 장">
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Rect
          x={4.5}
          y={1.5}
          width={10}
          height={10}
          rx={2}
          fill="none"
          stroke={palette.white}
          strokeWidth={1.5}
        />
        <Rect x={1.5} y={4.5} width={10} height={10} rx={2} fill={palette.white} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { overflow: 'hidden' },
  outlined: { borderWidth: StyleSheet.hairlineWidth },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing['025'] },
  words: { padding: spacing['100'], justifyContent: 'space-between' },
  /** 따옴표는 글자 높이가 커서 위쪽 여백을 먹는다. 줄 높이를 좁혀 붙인다 */
  quote: { lineHeight: 24, height: 20 },
  wordsBody: { textAlign: 'center' },
  wordsFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  badges: {
    position: 'absolute',
    top: spacing['075'],
    right: spacing['075'],
    flexDirection: 'row',
    gap: spacing['050'],
  },
})
