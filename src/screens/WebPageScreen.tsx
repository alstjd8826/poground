import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { InlineState } from '@/components/feedback/States'
import { PrimaryButton } from '@/components/foundation/PrimaryButton'
import { openExternal } from '@/utils/openExternal'

export interface WebPageScreenProps {
  url: string
  /** 밖에서 열 때 쓸 이름. 실패했을 때 어디로 보내는지 알린다 */
  label?: string
}

/**
 * 남의 글은 남의 자리에서 읽는다.
 *
 * 기사 본문을 우리 서버에 담아 우리 화면에 그리면 그건 인용이 아니라 복제·전송이다.
 * 대신 원문을 그 사이트에서 띄운다 — 광고도 표기도 그쪽 것이 그대로 나오고, 우리는
 * 길만 놓는다. 오래 버틴 비공식 팬앱들이 전부 이 방식이다.
 *
 * 화면을 새로 밀어 넣는 이유는 뒤로 가기가 자연스럽기 때문이다. 시트로 띄우면 기사 안에서
 * 링크를 타고 들어갔을 때 돌아올 길이 흐려진다.
 */
export function WebPageScreen({ url, label }: WebPageScreenProps) {
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: theme.background }]}>
        <InlineState tone="error" message="페이지를 열지 못했습니다" />
        <View style={styles.escape}>
          <PrimaryButton label="브라우저로 열기" onPress={() => openExternal(url, label ?? '원문')} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <WebView
        source={{ uri: url }}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        allowsBackForwardNavigationGestures
        startInLoadingState={false}
      />
      {loading && (
        // 받아오는 동안 흰 화면만 남으면 멈춘 것처럼 보인다
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  escape: { paddingHorizontal: spacing['200'], paddingTop: spacing['200'], width: '100%' },
})
