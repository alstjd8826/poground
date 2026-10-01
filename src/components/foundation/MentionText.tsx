import { Text, type TextProps } from 'react-native'

import { useTheme } from '@/hooks/theme/ThemeProvider'
import { splitMentions } from '@/models/mention'

/**
 * 본문 글자. 속의 @아이디 만 강조색으로 칠한다 — 댓글·답글·게시글이 같이 쓴다 (2026-09-29).
 *
 * 글자 안에 글자를 넣는다. 공유 전환 태그가 붙는 자리(매치 카드 스코어)에서는 안쪽이 복제에 안 따라오므로
 * 쓰지 않는다. 여기 쓰이는 본문들은 태그가 없다.
 */
export function MentionText({ children, ...props }: Omit<TextProps, 'children'> & { children: string }) {
  const theme = useTheme()
  return (
    <Text {...props}>
      {splitMentions(children).map((part, i) =>
        part.mention ? (
          <Text key={i} style={{ color: theme.accent }}>
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  )
}
