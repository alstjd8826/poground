import { Alert, Linking } from 'react-native'

import { openExternal } from '@/utils/openExternal'

/**
 * 앱 밖으로 나가기 전에 반드시 한 번 묻는다.
 *
 * 묻지 않고 열어 버리면 쓰는 사람에게는 앱이 멋대로 닫힌 것처럼 보인다. 특히 티켓 예매는
 * 돈이 오가는 곳이라 더 그렇다.
 *
 * 확인을 누르기 전에는 **절대 열리지 않아야** 한다. 이것이 이 함수의 전부다.
 */

/** Alert 에 올라온 단추를 이름으로 눌러 본다 */
function pressButton(name: string) {
  const [, , buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1)!
  const button = (buttons as Array<{ text: string; onPress?: () => void }>).find(b => b.text === name)
  expect(button).toBeDefined()
  button!.onPress?.()
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('부르자마자 열지 않고 먼저 묻는다', () => {
  openExternal('https://example.com', '티켓 예매')

  expect(Alert.alert).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).not.toHaveBeenCalled()
})

it('어디로 가는지 제목에 적는다', () => {
  openExternal('https://example.com', '티켓 예매')

  const [title] = (Alert.alert as jest.Mock).mock.calls[0]!
  expect(title).toContain('티켓 예매')
})

it('취소를 누르면 열지 않는다', () => {
  openExternal('https://example.com', '티켓 예매')
  pressButton('취소')

  expect(Linking.openURL).not.toHaveBeenCalled()
})

it('확인을 누르면 그때 연다', () => {
  openExternal('https://example.com/ticket', '티켓 예매')
  pressButton('확인')

  expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/ticket')
})

/**
 * 앱 밖으로 나가는 길이 하나뿐인지 본다.
 *
 * "모든 부분에서 알림을 띄운다" 는 규칙은 한 군데만 빠뜨려도 깨지는데, 빠뜨린 곳은
 * 눌러 보기 전까지 아무도 모른다. 그래서 소스를 직접 훑어 openExternal 말고 다른 데서
 * 주소를 여는 것을 막는다.
 *
 * 막는 대상은 **여는 행위**(openURL)다. 이름에 Linking 이 들어간다고 다 밖으로 나가는
 * 것은 아니다 — expo-linking 의 createURL 은 우리 앱으로 **돌아올** 주소를 만들 뿐이라
 * 여기 해당하지 않는다 (카카오 로그인이 쓴다).
 */
it('openExternal 밖에서는 주소를 열지 않는다', () => {
  const { execSync } = require('child_process')
  const path = require('path')
  const root = path.resolve(__dirname, '..')

  // grep 은 못 찾으면 종료코드 1 을 내므로 실패를 삼킨다
  const found = execSync(
    `grep -rn "openURL" ${root}/src --include=*.ts --include=*.tsx | grep -v "utils/openExternal.ts" || true`,
    { encoding: 'utf8' },
  ).trim()

  expect(found).toBe('')
})

/**
 * react-native 의 Linking 을 직접 들여오는 곳도 openExternal 하나여야 한다.
 * openURL 만 막으면 canOpenURL 로 슬쩍 다른 앱을 여는 길이 남는다.
 */
it('react-native 의 Linking 은 openExternal 만 들여온다', () => {
  const { execSync } = require('child_process')
  const path = require('path')
  const root = path.resolve(__dirname, '..')

  const found = execSync(
    `grep -rln "Linking" ${root}/src --include=*.ts --include=*.tsx ` +
      `| xargs grep -l "from 'react-native'" ` +
      `| xargs grep -ln "Linking.*} from 'react-native'\\|Linking } from 'react-native'" ` +
      `| grep -v "utils/openExternal.ts" || true`,
    { encoding: 'utf8' },
  ).trim()

  expect(found).toBe('')
})
