import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { InlineState } from '@/components/feedback/States'
import { PressableScale } from '@/components/foundation/PressableScale'
import { Skeleton } from '@/components/foundation/Skeleton'
import { useReports } from '@/hooks/comment/useReports'
import type { Report } from '@/repositories/comment/reports'

/** 신고당한 글에서 목록에 내보일 길이. 넘치면 꼬리를 자른다 */
const PREVIEW = 140

const SUBJECT_LABEL: Record<Report['subject']['type'], string> = {
  match: '경기',
  player: '선수',
  news: '소식',
  post: '게시글',
}

export interface ReportInboxScreenProps {
  /** 신고당한 글이 달린 화면으로 보낸다. 글만 보고는 무슨 맥락인지 알 수 없다 */
  onOpen?: (subject: Report['subject']) => void
}

/**
 * 신고함. 관리자만 들어온다.
 *
 * 심사 지침 1.2 는 신고 수단만이 아니라 **제때 응답**을 요구한다. 메일로만 받으면
 * 무엇이 남았는지 셀 수가 없어서, 처리했다는 사실을 남길 자리를 여기에 둔다.
 *
 * 줄 단위는 **신고 건이 아니라 신고당한 대상**(댓글·게시글)이다. 표의 기본키가 (대상, 신고한 사람)
 * 이라 한 대상에 여러 사람이 각각 한 건씩 넣을 수 있다. 그래도 관리자가 판단할 일은
 * 하나뿐이라 한 줄로 묶고, 몇 명이 눌렀는지만 숫자로 적는다.
 */
export function ReportInboxScreen({ onOpen }: ReportInboxScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { reports, query, onlyOpen, setOnlyOpen, resolve, removeAndResolve } = useReports()

  const confirmRemove = (r: Report) => {
    Alert.alert(
      r.kind === 'post' ? '이 글을 내릴까요?' : '이 댓글을 지울까요?',
      '지우면 신고도 함께 처리된 것으로 표시됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '지우기',
          style: 'destructive',
          onPress: () => removeAndResolve.mutate(r),
        },
      ],
    )
  }

  /*
    처리 완료도 되묻는다.

    지우기만 묻고 이건 바로 넘기면, 미처리 목록에서 줄이 사라지는 것이 같은데 한쪽만
    확인을 받는 셈이다. 되돌리는 길도 없다 — resolve_report 는 처리 시각을 남기지
    지우지는 않는다.
  */
  const confirmResolve = (r: Report) => {
    Alert.alert('처리 완료로 표시할까요?', '미처리 목록에서 빠집니다. 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '처리 완료', onPress: () => resolve.mutate(r) },
    ])
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
      showsVerticalScrollIndicator={false}
    >
      {/* 기본은 미처리만. 할 일 목록이라 끝난 것까지 섞이면 남은 수를 세어야 한다 */}
      <PressableScale
        scaleTo={0.98}
        onPress={() => setOnlyOpen(v => !v)}
        accessibilityRole="button"
        accessibilityState={{ selected: onlyOpen }}
        accessibilityLabel={onlyOpen ? '처리된 것도 보기' : '미처리만 보기'}
        style={[styles.filter, { borderColor: theme.border }]}
      >
        <Text style={[fonts.label, { color: theme.accent }]}>
          {onlyOpen ? '미처리만 보는 중 · 전체 보기' : '전체를 보는 중 · 미처리만 보기'}
        </Text>
      </PressableScale>

      <Body
        pending={query.isPending}
        error={query.isError}
        onRetry={() => query.refetch()}
        empty={reports.length === 0}
        onlyOpen={onlyOpen}
      >
        {reports.map(r => (
          <Card
            key={`${r.kind}-${r.targetId}`}
            report={r}
            busy={resolve.isPending || removeAndResolve.isPending}
            onResolve={() => confirmResolve(r)}
            onRemove={() => confirmRemove(r)}
            onOpen={onOpen && (() => onOpen(r.subject))}
          />
        ))}
      </Body>

      {query.hasNextPage && (
        <PressableScale
          scaleTo={0.99}
          onPress={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          accessibilityRole="button"
          style={[styles.more, { borderColor: theme.border }]}
        >
          <Text style={[fonts.label, { color: theme.textSecondary }]}>
            {query.isFetchingNextPage ? '불러오는 중' : '더 보기'}
          </Text>
        </PressableScale>
      )}
    </ScrollView>
  )
}

/** 기다림·실패·빈 것·있음을 한자리에서 가른다. 부르는 쪽에 늘어놓으면 조건이 네 겹이 된다 */
function Body({
  pending,
  error,
  onRetry,
  empty,
  onlyOpen,
  children,
}: {
  pending: boolean
  error: boolean
  onRetry: () => void
  empty: boolean
  onlyOpen: boolean
  children: React.ReactNode
}) {
  if (pending) {
    return (
      <View style={styles.stack}>
        <Skeleton width="100%" height={96} radius={cornerRadius['150']} />
        <Skeleton width="100%" height={96} radius={cornerRadius['150']} />
      </View>
    )
  }
  if (error) return <InlineState tone="error" message="불러오지 못했습니다" onRetry={onRetry} />
  if (empty) {
    return <InlineState message={onlyOpen ? '처리할 신고가 없습니다' : '들어온 신고가 없습니다'} />
  }
  return <View style={styles.stack}>{children}</View>
}

function Card({
  report,
  busy,
  onResolve,
  onRemove,
  onOpen,
}: {
  report: Report
  busy: boolean
  onResolve: () => void
  onRemove: () => void
  /** 글이 달린 화면으로 가는 길. 없으면 누를 수 없는 카드가 된다 */
  onOpen?: () => void
}) {
  const theme = useTheme()
  const preview = report.body.length > PREVIEW ? `${report.body.slice(0, PREVIEW)}…` : report.body
  // 게시글 신고는 글 자체가, 댓글 신고는 달린 곳의 댓글이 대상이다 (0025)
  const post = report.kind === 'post'

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/*
        본문만 눌리게 하고 단추는 이 바깥에 둔다. 누르는 자리를 겹쳐 두면 "지우기" 를
        노리다 카드가 열리는 일이 생긴다 — 되돌릴 수 없는 단추 옆에서는 특히 나쁘다.
      */}
      <PressableScale
        scaleTo={0.99}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole="button"
        accessibilityLabel={
          post ? '신고된 게시글 보기' : `${SUBJECT_LABEL[report.subject.type]}에 달린 신고된 댓글 보기`
        }
        style={styles.body}
      >
        <View style={styles.head}>
          <Text style={[fonts.label, { color: theme.accent }]}>{report.count}명이 신고</Text>
          <Text style={[fonts.caption, { color: theme.textMuted }]}>
            {post ? '게시글' : `${SUBJECT_LABEL[report.subject.type]} 댓글`} · @
            {report.handle ?? '알 수 없음'}
          </Text>
        </View>

        {/* 지워진 글은 본문이 비어서 온다. 빈 줄만 남으면 무엇이 신고됐는지 알 수 없다 */}
        <Text style={[fonts.bodySmall, { color: report.deleted ? theme.textDisabled : theme.textPrimary }]}>
          {report.deleted ? (post ? '이미 지워진 글입니다' : '이미 지워진 댓글입니다') : preview}
        </Text>

        {report.reasons.length > 0 && (
          <Text style={[fonts.caption, { color: theme.textMuted }]}>사유 · {report.reasons.join(', ')}</Text>
        )}
      </PressableScale>

      <View style={styles.actions}>
        {/* 이미 지운 글에는 지울 것이 없다. 처리 표시만 남는다 */}
        {!report.deleted && (
          <Action
            label={post ? '글 지우기' : '댓글 지우기'}
            tone={theme.loss}
            onPress={onRemove}
            disabled={busy}
          />
        )}
        {!report.resolved && (
          <Action label="처리 완료" tone={theme.accent} onPress={onResolve} disabled={busy} />
        )}
        {report.resolved && <Text style={[fonts.caption, { color: theme.textMuted }]}>처리됨</Text>}
      </View>
    </View>
  )
}

function Action({
  label,
  tone,
  onPress,
  disabled,
}: {
  label: string
  tone: string
  onPress: () => void
  disabled: boolean
}) {
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
    >
      <Text style={[fonts.label, { color: tone }]}>{label}</Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['150'] },
  stack: { gap: spacing['150'] },
  filter: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing['150'],
    paddingVertical: spacing['100'],
    borderRadius: cornerRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    padding: spacing['200'],
    gap: spacing['100'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { gap: spacing['100'] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing['200'], marginTop: spacing['050'] },
  action: { paddingVertical: spacing['050'] },
  more: {
    alignItems: 'center',
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
})
