import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { motion } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PlayerSilhouette, SILHOUETTE_SQUARE } from '@/components/club/PlayerPhoto'
import { normalizeKakaoAvatar } from '@/utils/kakaoAvatar'

export interface AvatarProps {
  url: string | null
  size?: number
}

/**
 * 프로필 이미지.
 *
 * 로그인한 계정에 사진이 있으면 그것을, 없으면 선수 자리표시자와 **같은 실루엣** 을
 * 쓴다. 이 앱에서 "사람 사진이 아직 없다" 를 이미 그 그림으로 말하고 있으므로, 여기만
 * 다른 그림을 쓰면 같은 뜻에 두 가지 표시가 생긴다.
 *
 * 실루엣은 사진이 있어도 밑에 깔아 둔다. 사진을 받는 중이거나 못 받았을 때 빈
 * 동그라미가 아니라 기본 이미지가 보인다.
 *
 * 주소는 여기서 한 번 더 다듬는다. 게시글·댓글은 DB 에 적힌 값을 그대로 넘기는데,
 * 거기에 카카오의 "사진 없음" 그림이나 http 주소가 남아 있을 수 있다.
 *
 * 보는 창은 정사각형으로 좁힌다 — 3:4 를 동그란 자리에 그대로 넣으면 어깨 아래 빈
 * 공간이 절반을 먹어 머리가 작게 박힌다.
 */
export function Avatar({ url, size = 72 }: AvatarProps) {
  const theme = useTheme()
  const shape = { width: size, height: size, borderRadius: size / 2 }
  const source = normalizeKakaoAvatar(url)

  return (
    <View
      style={[shape, styles.fallback, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
    >
      <PlayerSilhouette viewBox={SILHOUETTE_SQUARE} style={styles.fill} />
      {source && (
        <Image
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          // 주소가 바뀌면 건너가며 스며든다. 올린 직후 사진이 툭 갈리지 않는다.
          // 전에는 key 로 다시 마운트시켜 FadeIn 을 걸었는데, expo-image 는 이걸 제가 한다
          transition={motion.duration.normal}
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { width: '100%', height: '100%' },
})
