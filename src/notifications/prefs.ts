import { useCallback, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { DEFAULT_PREFS, type NotificationPrefs } from '@/models/notificationPlan'

/**
 * 알림 설정 (2026-09-30). 기기마다 따로다 — 알림은 기기가 울리는 것이라 계정에 두지 않는다.
 *
 * 여러 화면(알림 설정, 앱 전체의 예약 동기화)이 같은 값을 보므로 한 곳에 두고 구독한다.
 */
const STORAGE_KEY = 'notificationPrefs'

let prefs: NotificationPrefs = DEFAULT_PREFS
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function ensureLoaded() {
  if (loading) return
  loading = AsyncStorage.getItem(STORAGE_KEY)
    .then(raw => {
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<NotificationPrefs>
      prefs = { ...DEFAULT_PREFS, ...saved }
      emit()
    })
    .catch(() => {})
}

function subscribe(listener: () => void) {
  ensureLoaded()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useNotificationPrefs() {
  const current = useSyncExternalStore(
    subscribe,
    () => prefs,
    () => prefs,
  )
  const setPrefs = useCallback(async (patch: Partial<NotificationPrefs>) => {
    prefs = { ...prefs, ...patch }
    emit()
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)).catch(() => {})
  }, [])
  return { prefs: current, setPrefs }
}

/** 테스트끼리 값이 새지 않게 처음으로 되돌린다 */
export function resetNotificationPrefsForTest() {
  prefs = DEFAULT_PREFS
  loading = null
}
