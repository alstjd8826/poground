import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { randomUUID } from 'expo-crypto'

import { cornerRadius, fonts, palette, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { useAuth } from '@/hooks/auth/useAuth'
import { PressableScale } from '@/components/foundation/PressableScale'
import type { SaveAction } from '@/components/foundation/HeaderAction'
import { InlineState } from '@/components/feedback/States'
import { usePhotoAt, usePost, useSavePost } from '@/hooks/community/useCommunity'
import { useMatches } from '@/hooks/query/useKleague'
import type { PostMatchKey } from '@/models/community'
import { attendanceKeyOf, sameKey } from '@/models/attendance'
import { matchFromBody, matchTag, roomBeforeTags, withMatchTag } from '@/models/postTags'
import {
  BODY_MAX,
  canSubmit,
  type DraftPhoto,
  draftFromPost,
  draftReducer,
  emptyDraft,
  roomForPhotos,
} from '@/models/postDraft'
import { pickManyFromLibrary } from '@/utils/pickPhoto'
import { activeMention, pickMention } from '@/models/mention'
import { MentionSuggestions } from '@/components/foundation/MentionSuggestions'

export interface PostComposerScreenProps {
  /** 고칠 글. 없으면 새 글 */
  postId?: string
  /** 경기 상세에서 들어오면 본문에 그 경기 태그가 들어가 있다 */
  match?: PostMatchKey
  /** 헤더의 [올리기]/[저장] 에 걸 것 */
  onSaveAction?: (action: SaveAction) => void
  /** 저장이 끝났다. created 는 새 글인지 */
  onDone?: (postId: string, created: boolean) => void
}

const THUMB = 76

/**
 * 글쓰기와 고치기. 한 화면이다.
 *
 * 초안은 화면이 들고 있다. 올리기가 실패해도 지우지 않는다 — 사진을 다시 고르고 글을 다시
 * 쓰게 하면 안 된다. 새 글의 id 는 화면을 열 때 정한다. 사진 경로에 글 id 가 들어가서 글보다
 * 사진을 먼저 올리려면 그래야 한다.
 *
 * 사진은 앨범에서만 넣는다. 직관 글과 경기는 따로 켜는 칸 없이 본문의 태그가 정한다 — 경기를
 * 고르면 본문에 #직관 과 경기 태그가 들어가고, 저장할 때 그 태그로 경기를 찾는다 (2026-09-29).
 */
export function PostComposerScreen({ postId, match, onSaveAction, onDone }: PostComposerScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { session } = useAuth()
  const me = session?.user.id ?? null
  const editing = postId !== undefined
  const [id] = useState(() => postId ?? randomUUID())
  const [draft, dispatch] = useReducer(draftReducer, undefined, emptyDraft)
  // 본문 커서. @ 를 치면 커서 앞 @글자 로 아이디 후보를 찾는다 — 댓글 입력칸과 같다 (2026-09-29)
  const [cursor, setCursor] = useState(0)
  const [forced, setForced] = useState<{ start: number; end: number } | undefined>(undefined)
  const typing = activeMention(draft.body, cursor)
  const pick = useCallback(
    (handle: string) => {
      if (!typing) return
      const next = pickMention(draft.body, typing, cursor, handle)
      dispatch({ type: 'setBody', body: next.text })
      setCursor(next.cursor)
      setForced({ start: next.cursor, end: next.cursor })
    },
    [cursor, draft.body, typing],
  )
  /*
    결과 객체(useMutation) 통째가 아니라 mutateAsync 만 쥔다. 결과 객체는 렌더마다 새로 만들어져,
    그것에 기대면 submit 이 매번 바뀌고 → 헤더에 다시 걸고 → 라우트가 다시 그리고 → 또 바뀌어
    끝없이 돈다. 폰에서는 [글쓰기] 를 누르자마자 앱이 꺼졌다(2026-09-29)
  */
  const { mutateAsync: saveAsync, isPending: saving } = useSavePost()

  // 고칠 글은 한 번만 채운다. 다시 불러올 때마다 채우면 쓰던 것이 날아간다
  const { post, query } = usePost(postId ?? '')
  const filled = useRef(false)
  useEffect(() => {
    if (!editing || filled.current || !post || post.authorId !== me) return
    filled.current = true
    dispatch({ type: 'reset', draft: draftFromPost(post) })
  }, [editing, me, post])

  const blockedReason = !editing
    ? null
    : query.isPending
      ? 'loading'
      : !post
        ? '볼 수 없는 글입니다'
        : post.authorId !== me
          ? '내 글만 고칠 수 있습니다'
          : null

  const { data: matches } = useMatches()
  // 고를 수 있는 것은 이미 시작한 경기, 그리고 직관 예정으로 들어온 그 경기 (2026-09-29)
  const played = useMemo(
    () =>
      (matches ?? [])
        .filter(m => m.status !== 'scheduled' || (match !== undefined && sameKey(attendanceKeyOf(m), match)))
        .sort((a, b) => b.kickoffAtMs - a.kickoffAtMs),
    [match, matches],
  )

  // 본문의 경기 태그가 곧 고른 경기다. 쓰는 사람이 태그를 지우면 연결도 풀린다
  const chosen = useMemo(() => matchFromBody(draft.body, played), [draft.body, played])

  // 경기 상세에서 들어오면 그 경기 태그를 넣어 둔다. 경기 목록이 오면 한 번만
  const seeded = useRef(false)
  useEffect(() => {
    if (editing || !match || seeded.current) return
    const target = played.find(m => sameKey(attendanceKeyOf(m), match))
    if (!target) return
    seeded.current = true
    dispatch({ type: 'setBody', body: withMatchTag('', target, played) })
  }, [editing, match, played])

  // 헤더 버튼의 busy 는 다시 그린 뒤에야 걸린다. 그 사이 한 번 더 누르면 글이 두 개 올라간다
  const inFlight = useRef(false)
  const submit = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const saved = await saveAsync({
        postId: id,
        draft,
        previousPaths: editing && post ? post.photos.map(p => p.path) : [],
        match: chosen ? attendanceKeyOf(chosen) : null,
      })
      onDone?.(saved.id, !editing)
    } catch (e) {
      Alert.alert(
        editing ? '저장하지 못했습니다' : '올리지 못했습니다',
        `쓰던 글은 그대로 있습니다. 다시 올려 주세요.\n${e instanceof Error ? e.message : String(e)}`,
      )
    } finally {
      inFlight.current = false
    }
  }, [chosen, draft, editing, id, onDone, post, saveAsync])

  const ready = blockedReason === null && canSubmit(draft)
  useEffect(() => {
    onSaveAction?.({ onPress: () => void submit(), busy: saving, disabled: !ready })
  }, [onSaveAction, ready, saving, submit])

  const addFromLibrary = useCallback(async () => {
    const picked = await pickManyFromLibrary(roomForPhotos(draft))
    if (picked === 'denied') {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 글에 넣을 수 있습니다.')
      return
    }
    if (picked.length > 0) dispatch({ type: 'addPhotos', photos: picked })
  }, [draft])

  if (blockedReason === 'loading') return <InlineState message="글을 불러오는 중입니다" />
  if (blockedReason) return <InlineState message={blockedReason} />

  const room = roomForPhotos(draft)

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.photos}>
        {draft.photos.map((photo, i) => (
          <DraftThumb
            key={photo.key}
            photo={photo}
            first={i === 0}
            last={i === draft.photos.length - 1}
            onRemove={() => dispatch({ type: 'removePhoto', key: photo.key })}
            onMove={by => dispatch({ type: 'movePhoto', key: photo.key, by })}
          />
        ))}
        {room > 0 && (
          <AddTile label="+" accessibilityLabel="앨범에서 고르기" onPress={() => void addFromLibrary()} />
        )}
      </View>
      <Text style={[fonts.caption, { color: theme.textMuted }]}>{`사진 ${draft.photos.length}/4`}</Text>

      <TextInput
        value={draft.body}
        onChangeText={body => {
          dispatch({ type: 'setBody', body })
          setCursor(body.length)
        }}
        onSelectionChange={e => {
          setCursor(e.nativeEvent.selection.end)
          setForced(undefined)
        }}
        selection={forced}
        // 태그뿐인 본문이면 태그를 아래로 내리고 맨 앞에서 쓰게 한다
        onFocus={() => {
          const room = roomBeforeTags(draft.body)
          if (!room) return
          dispatch({ type: 'setBody', body: room.body })
          setCursor(room.cursor)
          setForced({ start: room.cursor, end: room.cursor })
        }}
        placeholder="경기장 이야기를 남겨 보세요"
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={BODY_MAX}
        style={[
          fonts.body,
          styles.body,
          { color: theme.textPrimary, backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      />
      <MentionSuggestions query={typing?.query ?? null} onPick={pick} />
      <Text style={[fonts.caption, styles.count, { color: theme.textMuted }]}>
        {`${draft.body.length}/${BODY_MAX}`}
      </Text>

      <Row label="경기 태그" hint="고르면 본문에 #직관 과 경기 태그가 들어갑니다. 다시 누르면 뺍니다" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {played.map(m => {
          const picked = chosen?.id === m.id
          const label = matchTag(m)
          return (
            <PressableScale
              key={m.id}
              scaleTo={0.96}
              onPress={() =>
                dispatch({ type: 'setBody', body: withMatchTag(draft.body, picked ? null : m, played) })
              }
              accessibilityLabel={picked ? `${label}, 고름` : label}
              style={[
                styles.chip,
                { borderColor: picked ? theme.accent : theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Text style={[fonts.caption, { color: picked ? theme.accent : theme.textSecondary }]}>
                {label}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>

      <Row label="나만 보기" hint="켜면 커뮤니티에 올라가지 않고 나만 봅니다">
        <Switch
          accessibilityLabel="나만 보기"
          value={draft.visibility === 'private'}
          onValueChange={on => dispatch({ type: 'setVisibility', visibility: on ? 'private' : 'public' })}
        />
      </Row>
    </ScrollView>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[fonts.label, { color: theme.textPrimary }]}>{label}</Text>
        {hint && <Text style={[fonts.caption, { color: theme.textMuted }]}>{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

function AddTile({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string
  accessibilityLabel: string
  onPress: () => void
}) {
  const theme = useTheme()
  return (
    <PressableScale
      scaleTo={0.95}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      // 테두리는 옅은 선(border)이 아니라 흐린 글자색으로 — 사진 칸 바탕 위에서 칸이 보여야 한다
      style={[styles.thumb, styles.add, { borderColor: theme.textMuted }]}
    >
      <Text style={[fonts.title1, { color: theme.textMuted }]}>{label}</Text>
    </PressableScale>
  )
}

/**
 * 초안 사진 한 장. 막 고른 것은 기기 파일을, 이미 올라간 것은 캐시 파일을 그린다.
 *
 * 순서는 끌어 옮기지 않고 앞뒤 단추로 바꾼다. 4장뿐이라 단추 두 번이면 어디든 간다.
 */
function DraftThumb({
  photo,
  first,
  last,
  onRemove,
  onMove,
}: {
  photo: DraftPhoto
  first: boolean
  last: boolean
  onRemove: () => void
  onMove: (by: -1 | 1) => void
}) {
  const theme = useTheme()
  const cached = usePhotoAt(photo.kind === 'remote' ? photo.path : null)
  const uri = photo.kind === 'local' ? photo.uri : cached
  return (
    <View style={styles.thumbWrap}>
      <View style={[styles.thumb, { backgroundColor: theme.skeleton }]}>
        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <PressableScale onPress={onRemove} accessibilityLabel="사진 빼기" style={styles.remove}>
          <Text style={[fonts.caption, styles.removeMark]}>✕</Text>
        </PressableScale>
      </View>
      <View style={styles.moves}>
        <PressableScale disabled={first} onPress={() => onMove(-1)} accessibilityLabel="앞으로">
          <Text style={[fonts.caption, { color: first ? theme.textDisabled : theme.textSecondary }]}>‹</Text>
        </PressableScale>
        <PressableScale disabled={last} onPress={() => onMove(1)} accessibilityLabel="뒤로">
          <Text style={[fonts.caption, { color: last ? theme.textDisabled : theme.textSecondary }]}>›</Text>
        </PressableScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['100'] },
  thumbWrap: { gap: spacing['050'] },
  thumb: { width: THUMB, height: THUMB, borderRadius: cornerRadius['150'], overflow: 'hidden' },
  add: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  removeMark: { color: palette.white },
  moves: { flexDirection: 'row', justifyContent: 'space-around' },
  body: {
    minHeight: 160,
    padding: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    textAlignVertical: 'top',
  },
  count: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['150'] },
  rowText: { flex: 1, gap: spacing['025'] },
  chips: { gap: spacing['100'] },
  chip: {
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
