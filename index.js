import 'react-native-gesture-handler'
import 'react-native-url-polyfill/auto'
import { registerRootComponent } from 'expo'

import App from './src/App'

// Expo 에서는 AppRegistry 대신 이걸 쓴다. 네이티브/Expo Go 양쪽 진입점을 맞춰준다.
registerRootComponent(App)
