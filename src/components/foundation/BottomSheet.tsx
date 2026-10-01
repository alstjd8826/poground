import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { PressableScale } from '@/components/foundation/PressableScale'

/**
 * 들고 나는 동작을 우리가 몬다.
 *
 * Modal 의 animationType 에 맡기면 닫힐 때 **아래로 미끄러지지 않는다** — fade 는 그냥
 * 흐려지고, slide 는 배경까지 통째로 민다. 애플 시트의 인상은 "아래에서 올라와 아래로
 * 내려간다" 는 데서 오므로 그 한 가지는 직접 그린다.
 *
 * 그러려면 닫는 동안 Modal 이 떠 있어야 한다. open 이 꺼져도 내려가는 동안은 mounted 를
 * 붙잡고, 다 내려간 뒤에 걷는다.
 */
const SETTLE = { damping: 26, stiffness: 260, mass: 0.9, reduceMotion: ReduceMotion.System }
const LEAVE = { duration: motion.duration.fast, reduceMotion: ReduceMotion.System }

/** 이만큼 끌어내리면 닫는다. 짧으면 스크롤하려다 닫히고, 길면 닫는 맛이 없다 */
const DISMISS_DISTANCE = 120

/** 짧게 튕겨도 닫히게 하는 속도(px/s). 거리로만 재면 빠른 손짓이 무시된다 */
const DISMISS_VELOCITY = 800

/**
 * 화면 가장자리에서 들이는 폭.
 *
 * 애플 시트는 화면을 다 덮지 않을 때 **좌·우·아래 모두** 살짝 떠서 뒤에 화면이 남아
 * 있다는 것을 보여 준다. 도해에서 잰 값이 옆 4.6pt, 아래 5.4pt 라 5 로 맞춘다.
 */
const EDGE_INSET = 5

/**
 * 기기 화면 모서리. 도해에서 잰 값이다 — 화면에 꽉 찬 대형 시트의 아래 곡선이 곧 그것이라
 * 거기서 55pt 가 나왔다.
 */
const SCREEN_CORNER = 55

/**
 * 아래 모서리는 위보다 더 둥글다.
 *
 * 화면 모서리 **안에** 들어앉기 때문이다. 겹친 둥근 사각형은 동심원이라야 결이 맞는데,
 * 그러려면 안쪽 반경이 바깥 반경에서 간격만큼 작아야 한다. 위는 기기 모서리와 상관없는
 * 자리라 시트 제 반경(32)을 쓴다.
 */
const BOTTOM_RADIUS = SCREEN_CORNER - EDGE_INSET

export interface SheetAction {
  label: string
  onPress: () => void
}

export interface BottomSheetProps {
  open: boolean
  /** 위에 적는 제목 */
  title?: string
  onClose: () => void
  /**
   * 다 내려가고 화면에서 사라진 뒤에 부른다.
   *
   * 시트를 닫고 곧바로 다른 것을 띄우려면 이 시점을 알아야 한다. 내려가는 도중에
   * Modal 을 하나 더 띄우면 iOS 가 두 번째를 삼켜서 아무것도 안 뜬다.
   */
  onClosed?: () => void
  children: ReactNode
  /**
   * 위 왼쪽에 놓는 것. 되돌리고 닫는 행동이다(취소).
   *
   * 고른 것이 곧바로 반영되는 시트에는 되돌릴 것이 없으므로 주지 않아도 된다.
   */
  cancel?: SheetAction
  /** 위 오른쪽에 놓는 것. 마치고 닫는 행동이다(완료) */
  done?: SheetAction
  /**
   * 화면 높이 중 시트가 쓸 수 있는 몫.
   * 내용이 짧으면 그만큼만 쓰고, 길면 여기서 멈추고 안에서 굴러간다.
   */
  maxHeightRatio?: number
}

/**
 * 아래에서 올라오는 시트.
 *
 * 한 가지를 고르는 일에 화면을 새로 밀어넣을 필요는 없다. 시트는 뒤에 있던 화면을
 * 남겨 두므로 "지금 무엇을 고치는 중인지" 가 안 사라진다.
 *
 * 애플 HIG(Sheets)를 따라 셋을 지킨다.
 *
 * 1. **끌어내려 닫을 수 있다.** HIG 가 "사람들은 닫기 단추를 누르는 대신 세로로 쓸어
 *    내려 닫기를 기대한다" 고 못 박는다. 전에는 손잡이만 그려 두고 그 몸짓을 받지
 *    않았는데, 손잡이는 끌 수 있다는 표시라 받지 않으면 거짓말이 된다.
 * 2. **마치는 단추는 위 오른쪽, 취소는 위 왼쪽.** iOS 에서 정해진 자리다. 아래에 큰
 *    단추로 두면 내용이 길 때 스크롤 밖으로 밀리고, 자리도 규격과 어긋난다.
 * 3. **한 번에 하나만 띄운다.** 시트에서 또 시트를 열면 닫았을 때 어디로 돌아가는지
 *    흐려진다. 이건 부르는 쪽이 지킬 몫이다.
 *
 * 들어올 때는 밑에서 밀려 올라오고, 나갈 때는 통째로 잦아든다. 나가는 쪽을 따로
 * 애니메이션하지 않는 이유는 Modal 이 닫히는 순간 자식이 곧바로 사라져서 나가는
 * 동작이 재생될 틈이 없기 때문이다 — 배경이 함께 흐려지므로 눈에 거슬리지 않는다.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  onClosed,
  children,
  cancel,
  done,
  maxHeightRatio = 0.8,
}: BottomSheetProps) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()

  /**
   * 닫는 동안에도 Modal 을 붙잡아 둔다. open 이 꺼지자마자 걷으면 내려가는 모습이
   * 재생될 틈이 없다.
   */
  const [mounted, setMounted] = useState(open)

  /** 시트가 제자리에서 얼마나 내려가 있는지. 0 이면 다 올라온 것 */
  const offset = useSharedValue(0)
  /** 잰 시트 높이. 이만큼 내리면 화면 밖이다 */
  const sheetH = useSharedValue(height)

  /**
   * 콜백은 참조로 들고 effect 에서 떼어 놓는다.
   *
   * 부르는 쪽이 인라인 화살표로 넘기면 렌더마다 새 함수가 된다. 그걸 아래 effect 의
   * 의존성에 그대로 두면, 시트가 떠 있는 동안 부모가 다시 렌더될 때마다 effect 가 돌아
   * **들어오는 애니메이션이 처음부터 다시 재생된다** — 시트에서 색을 고를 때마다 시트가
   * 새로 뜨는 것처럼 보였다. effect 는 open 이 바뀔 때만 돌아야 한다.
   */
  const closed = useRef(onClosed)
  closed.current = onClosed

  const unmount = useCallback(() => {
    setMounted(false)
    closed.current?.()
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      // 아래에서 올라온다. 높이를 아직 못 쟀으면 화면 높이로 어림잡는다
      offset.value = sheetH.value
      offset.value = withSpring(0, SETTLE)
      return
    }
    // 다 내려간 뒤에 걷는다
    offset.value = withTiming(sheetH.value, LEAVE, done => {
      if (done) runOnJS(unmount)()
    })
  }, [open, offset, sheetH, unmount])

  const drag = Gesture.Pan()
    .onUpdate(e => {
      // 위로는 안 끌린다. 올려 봐야 갈 곳이 없는데 따라 올라가면 헛도는 느낌이 난다
      offset.value = Math.max(0, e.translationY)
    })
    .onEnd(e => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        // 손을 뗀 속도를 이어받아 마저 내려간다. 거기서 멈췄다 다시 떨어지면 끊겨 보인다
        offset.value = withTiming(sheetH.value, LEAVE, done => {
          if (done) runOnJS(onClose)()
        })
        return
      }
      offset.value = withSpring(0, SETTLE)
    })

  const follow = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }))

  /** 뒤 어둠은 시트를 따라 옅어진다. 끌어내리는 만큼 뒤가 돌아온다 */
  const dim = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, offset.value / Math.max(1, sheetH.value)),
  }))

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Modal 안은 바깥의 GestureHandlerRootView 밖이라 여기서 다시 세운다 */}
      <GestureHandlerRootView style={styles.fill}>
        {/*
          바깥을 누르면 닫는다. 시트 안쪽 누름은 아래 View 가 삼킨다.
          누르는 순간에 닫지 않는다 — 그러면 배경이 시트 안쪽 단추보다 먼저 터치를 채간다.
          시트에는 이제 입력칸이 없으므로(색 코드는 밖으로 나갔다) 서두를 이유도 없다.
        */}
        <Animated.View style={[styles.backdrop, styles.dim, dim]} pointerEvents="none" />
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />

        {/*
          키보드가 올라오면 시트가 그만큼 밀려 올라간다. 입력칸이 시트 안에 있으므로
          여기서 피하지 않으면 키보드가 입력칸을 덮는다. 뒤에 있는 화면은 그대로여서
          무엇을 고치는 중인지도 계속 보인다.
        */}
        <KeyboardAvoidingView
          style={styles.dock}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={drag}>
            <Animated.View
              onLayout={e => {
                sheetH.value = e.nativeEvent.layout.height
              }}
              style={[
                styles.sheet,
                follow,
                {
                  backgroundColor: theme.sheet,
                  maxHeight: height * maxHeightRatio,
                  paddingBottom: insets.bottom + spacing['200'],
                },
              ]}
            >
              {/* 손잡이. 이제 실제로 끌린다 — 끌어내리면 닫힌다 */}
              <View style={[styles.grabber, { backgroundColor: theme.border }]} />

              {/*
                위 줄. 취소는 왼쪽, 완료는 오른쪽 — iOS 에서 정해진 자리다.
                제목은 가운데 두되, 양옆 단추가 밀어내지 않게 같은 폭을 잡아 둔다.
              */}
              {(title || cancel || done) && (
                <View style={styles.bar}>
                  <View style={styles.barSide}>{cancel ? <BarButton {...cancel} muted /> : null}</View>
                  <Text
                    style={[fonts.headline, styles.title, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {title ?? ''}
                  </Text>
                  <View style={[styles.barSide, styles.barEnd]}>{done ? <BarButton {...done} /> : null}</View>
                </View>
              )}

              <ScrollView
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}

/** 위 줄에 놓는 글자 단추. 취소는 눈에 덜 띄게 둔다 */
function BarButton({ label, onPress, muted = false }: SheetAction & { muted?: boolean }) {
  const theme = useTheme()
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.barButton}
    >
      <Text style={[fonts.headline, { color: theme.accent }, muted && { color: theme.textSecondary }]}>
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /** 자리만 잡는다. 누름을 받는 쪽은 색이 없고, 색은 아래 dim 층이 낸다 */
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /** 뒤를 덮는 어둠. 시트를 끌어내리는 만큼 옅어진다 */
  dim: { backgroundColor: '#0009' },
  /** 시트를 아래로 붙인다. box-none 이라 빈 곳을 누르면 뒤의 backdrop 이 받는다 */
  dock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: cornerRadius['400'],
    borderTopRightRadius: cornerRadius['400'],
    borderBottomLeftRadius: BOTTOM_RADIUS,
    borderBottomRightRadius: BOTTOM_RADIUS,
    paddingHorizontal: spacing['200'],
    marginHorizontal: EDGE_INSET,
    marginBottom: EDGE_INSET,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing['150'],
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['150'],
  },
  /** 양옆을 같은 폭으로 잡아 제목이 가운데에 선다. 한쪽만 단추가 있어도 안 밀린다 */
  barSide: { minWidth: 64, justifyContent: 'center' },
  barEnd: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  barButton: { paddingVertical: spacing['050'] },
  body: { paddingTop: spacing['200'], gap: spacing['250'] },
})
