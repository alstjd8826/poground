import AsyncStorage from '@react-native-async-storage/async-storage'

import type { ActiveCountdown } from '@/models/liveActivityPlan'

/**
 * 지금 띄워 둔 카운트다운 (2026-09-30). 앱을 껐다 켜도 기억해야 같은 경기를 두 번 띄우지 않는다. 사용자가 잠금
 * 화면에서 밀어 치웠어도 여기 남아 있으므로 다시 띄우지 않는다 — 치운 것을 되살리면 성가시다.
 */
const STORAGE_KEY = 'liveActivity'

export async function readActive(): Promise<ActiveCountdown | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ActiveCountdown) : null
  } catch {
    return null
  }
}

export async function writeActive(active: ActiveCountdown | null): Promise<void> {
  if (active) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(active)).catch(() => {})
  else await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
}
