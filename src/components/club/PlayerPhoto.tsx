import { useState } from 'react'
import { type ImageStyle, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { useTheme } from '@/hooks/theme/ThemeProvider'

/**
 * 선수 사진의 비율.
 *
 * 수집기가 600x800 으로 줄여 저장하므로 3:4 다. 자리표시자도 같은 비율이어야
 * 사진이 있는 선수와 없는 선수가 한 줄에 섞여도 높이가 흔들리지 않는다.
 */
export const PHOTO_ASPECT = 3 / 4

/**
 * 선수 사진 비율(3:4)에 맞춘 실루엣의 보기 영역.
 * 프로필 이미지처럼 정사각형 자리에 넣을 때는 SILHOUETTE_SQUARE 를 쓴다.
 */
export const SILHOUETTE_TALL = '0 0 300 400'

/**
 * 머리와 어깨를 함께 담는 정사각형 영역. 프로필 이미지 자리에 쓴다.
 *
 * 3:4 실루엣을 동그란 자리에 그대로 넣으면 어깨 아래 빈 공간이 절반을 먹는다.
 * 같은 path 를 쓰면서 보는 창만 옮겨 흔한 프로필 사진 구도로 만든다.
 *
 * 창 크기가 구도를 전부 결정한다. 머리 경계는 x 92~208, y 92~220 (중심 150,156),
 * 어깨는 y 232 에서 시작한다. 한 변 300 을 어깨가 세로 65% 에서 시작하도록 놓으면
 *   머리 중심 세로 40%   머리 폭 39%   어깨가 65% 아래를 꽉 채움
 * 이 된다. 머리를 정확히 한가운데 두면(50 56 200 200) 머리가 폭의 58% 까지 커지고
 * 어깨가 원 밖으로 밀려 머리만 동그랗게 남는다 — 사람으로 안 읽힌다.
 */
export const SILHOUETTE_SQUARE = '0 37 300 300'

/**
 * 사진이 없는 선수의 자리표시자.
 *
 * 이미지 파일 대신 그린다. 크기를 키워도 뭉개지지 않고, 테마 색을 따라가고, 실제 사진과
 * 마찬가지로 배경이 비어 있어 카드 위에 똑같이 얹힌다.
 *
 * 구도는 실제 사진을 따랐다 — 머리가 위쪽 절반, 어깨가 아래 폭을 채운다. 그래야 있는 선수와
 * 없는 선수가 나란히 있을 때 눈높이가 맞는다.
 */
export function PlayerSilhouette({
  style,
  viewBox = SILHOUETTE_TALL,
}: {
  style?: ViewStyle
  viewBox?: string
}) {
  const theme = useTheme()
  return (
    <View style={style}>
      <Svg viewBox={viewBox} width="100%" height="100%">
        <Defs>
          {/* 아래로 갈수록 옅어진다. 실루엣이 잘린 것이 아니라 번져 사라지는 것처럼 보이게 */}
          <LinearGradient id="silhouette" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.textMuted} stopOpacity={0.45} />
            <Stop offset="1" stopColor={theme.textMuted} stopOpacity={0.12} />
          </LinearGradient>
        </Defs>
        {/* 머리 */}
        <Path d="M150 92c-33 0-58 27-58 62s25 66 58 66 58-31 58-66-25-62-58-62z" fill="url(#silhouette)" />
        {/* 어깨. 아래를 넉넉히 넘겨 그려 잘린 티가 나지 않게 한다 */}
        <Path d="M150 232c-63 0-114 40-114 92v96h228v-96c0-52-51-92-114-92z" fill="url(#silhouette)" />
      </Svg>
    </View>
  )
}

export interface PlayerPhotoProps {
  /** 없으면 곧바로 자리표시자를 그린다 */
  uri: string | null
  style?: StyleProp<ImageStyle>
}

/**
 * 선수 사진.
 *
 * 주소는 선수ID 로 조립하므로 "사진이 있는지" 를 미리 알 수 없다 — 없는 선수는 404 가 난다.
 * (2026 포항은 37명 중 둘) 그래서 실패를 보고 나서 자리표시자로 바꾼다.
 */
export function PlayerPhoto({ uri, style }: PlayerPhotoProps) {
  const [failed, setFailed] = useState(false)

  if (!uri || failed) return <PlayerSilhouette style={StyleSheet.flatten(style) as ViewStyle} />

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  )
}
