/**
 * WebView 테스트 스텁.
 *
 * react-native-webview 는 네이티브 모듈(RNCWebViewModule)을 TurboModuleRegistry 에서 강제로 찾는다.
 * jest 에는 네이티브가 없어 import 만 해도 Invariant Violation 으로 죽는다.
 * 유튜브 플레이어가 이걸 타고 들어오므로, 화면을 렌더하는 테스트에는 이 스텁이 필요하다.
 *
 * 재생 자체는 어차피 단말에서 확인해야 한다. 여기서는 "화면이 그려지는가" 까지만 본다.
 *
 * 주의: 루트 __mocks__/ 는 node_modules 패키지를 자동 목킹한다.
 */
import React from 'react'
import { View, type ViewProps } from 'react-native'

export const WebView = (props: ViewProps) => <View {...props} testID="webview" />

export default WebView
