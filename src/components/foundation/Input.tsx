import React, { forwardRef } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { cornerRadius, fonts, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'

/**
 * 입력칸.
 *
 * 안내 글자(placeholder)를 네이티브에 맡기지 않고 우리가 그린다.
 *
 * iOS 는 안내 글자를 칸 안에 놓을 때 서체의 자체 상하 여백을 쓰는데, K리그 서체는
 * 그 값이 치는 글자의 배치와 맞지 않아 둘이 서로 다른 높이에 앉는다. 안내 글자가
 * 있을 때와 칠 때 글자가 위아래로 움찔한다.
 *
 * 같은 style 을 쓰는 Text 를 같은 자리에 겹쳐 두면 그런 차이가 생길 여지가 없다.
 * 대신 placeholder 를 네이티브에 넘기지 않아야 두 개가 겹쳐 보이지 않는다.
 *
 * 지금은 카드 만들기만 쓰지만 여기 두는 이유는, 고치고 있는 것이 카드가 아니라 **서체와
 * iOS 의 궁합**이기 때문이다. 닉네임·아이디 화면도 같은 서체로 TextInput 을 그대로 쓰고
 * 있어 같은 문제를 안고 있다.
 */
export const Input = forwardRef<TextInput, React.ComponentProps<typeof TextInput>>(function Input(
  { placeholder, ...props },
  ref,
) {
  const theme = useTheme()
  const empty = !props.value

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={ref}
        {...props}
        style={[
          // fonts.body 가 아니라 fonts.field 다. lineHeight 가 있으면 iOS 에서 글자가
          // 칸의 가운데에 놓이지 않는다 (styles/fonts/font.ts 참고)
          fonts.field,
          styles.input,
          { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary },
        ]}
      />
      {empty && placeholder ? (
        // 글자를 치면 곧바로 사라진다. 눌러도 아래 입력칸이 받아야 하므로 손을 안 탄다
        <Text
          pointerEvents="none"
          numberOfLines={1}
          style={[fonts.field, styles.placeholder, { color: theme.textDisabled }]}
        >
          {placeholder}
        </Text>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  input: {
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['150'],
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  /**
   * 입력칸과 **같은 가로 여백** 으로 겹쳐 둔다. 세로는 감싼 뷰가 가운데로 맞춘다 —
   * 입력칸 높이가 패딩에 따라 달라지므로 숫자로 박아 두면 어긋난다.
   */
  placeholder: { position: 'absolute', left: spacing['200'], right: spacing['200'] },
})
