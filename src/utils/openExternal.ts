import { Alert, Linking } from 'react-native'

/**
 * 앱 밖으로 나가기 전에 한 번 묻는다.
 *
 * 누르면 곧바로 브라우저나 다른 앱으로 튕겨 나가는 것은, 쓰는 사람 입장에서는 앱이 멋대로
 * 닫힌 것처럼 느껴진다. 특히 티켓 예매처럼 돈이 오가는 곳으로 갈 때는 "지금 나간다" 는
 * 것을 알고 가야 한다.
 *
 * 앱 안에서 해결되는 이동(경기 상세, 영상 플레이어)에는 쓰지 않는다. 이 함수는 **정말로
 * 밖으로 나갈 때만** 거친다.
 */
export function openExternal(url: string, label: string): void {
  Alert.alert(
    `${label}(으)로 이동합니다`,
    '앱을 벗어나 외부 화면이 열립니다.',
    [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        onPress: () => {
          // 열 수 없는 주소여도 앱이 멈추면 안 된다. 왜 안 열렸는지만 알린다
          Linking.openURL(url).catch(() => {
            Alert.alert('열 수 없는 주소입니다', url)
          })
        },
      },
    ],
    { cancelable: true },
  )
}
