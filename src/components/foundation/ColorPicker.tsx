import { useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

import { cornerRadius, spacing } from '@/styles'

/**
 * 색상판.
 *
 * 왼쪽 네모에서 채도(가로)와 밝기(세로)를, 오른쪽 띠에서 색상(hue)을 집는다. 그림판이나
 * 디자인 도구에서 쓰는 그 배치다.
 *
 * 색을 HSV 로 들고 있는 이유는 이 배치가 곧 HSV 이기 때문이다. 16진 코드로만 들고 있으면
 * 검정(#000000)에 닿는 순간 무슨 색이었는지가 사라져서, 다시 밝기를 올렸을 때 엉뚱한
 * 색이 나온다.
 */

const SQUARE_HEIGHT = 180
const HUE_WIDTH = 28
/** 집는 자리를 보여주는 동그라미 */
const HANDLE = 18

export interface HSV {
  /** 0..360 */
  h: number
  /** 0..1 */
  s: number
  /** 0..1 */
  v: number
}

export function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const i = Math.floor(h / 60) % 6
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[i]!
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase()
}

export function hexToHsv(hex: string): HSV {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min

  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

/** 색상 띠의 여섯 구간. 위에서 아래로 한 바퀴 돈다 */
const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000']

export interface ColorPickerProps {
  /** #RRGGBB */
  value: string
  onChange: (hex: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [width, setWidth] = useState(0)
  /**
   * 화면에 보이는 색이 아니라 "집고 있는 자리" 를 들고 있는다.
   *
   * 밖에서 색이 바뀌면(코드 입력) 따라가되, 여기서 집는 동안에는 이쪽이 주인이다.
   * 그래야 검정까지 내렸다 올려도 색상이 유지된다.
   */
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value))
  const [dragging, setDragging] = useState(false)

  if (!dragging && hsvToHex(hsv) !== value.toUpperCase()) {
    // 렌더 중 동기화. 바깥 값이 주인일 때만 일어난다
    setHsv(hexToHsv(value))
  }

  const apply = useCallback(
    (next: HSV) => {
      setHsv(next)
      onChange(hsvToHex(next))
    },
    [onChange],
  )

  const squareWidth = Math.max(width - HUE_WIDTH - spacing['150'], 1)

  const squarePan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(e => {
          runOnJS(setDragging)(true)
          runOnJS(apply)({
            h: hsv.h,
            s: Math.min(Math.max(e.x / squareWidth, 0), 1),
            v: 1 - Math.min(Math.max(e.y / SQUARE_HEIGHT, 0), 1),
          })
        })
        .onUpdate(e => {
          runOnJS(apply)({
            h: hsv.h,
            s: Math.min(Math.max(e.x / squareWidth, 0), 1),
            v: 1 - Math.min(Math.max(e.y / SQUARE_HEIGHT, 0), 1),
          })
        })
        .onFinalize(() => {
          runOnJS(setDragging)(false)
        }),
    [apply, hsv.h, squareWidth],
  )

  const huePan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(e => {
          runOnJS(setDragging)(true)
          runOnJS(apply)({ ...hsv, h: Math.min(Math.max(e.y / SQUARE_HEIGHT, 0), 1) * 360 })
        })
        .onUpdate(e => {
          runOnJS(apply)({ ...hsv, h: Math.min(Math.max(e.y / SQUARE_HEIGHT, 0), 1) * 360 })
        })
        .onFinalize(() => {
          runOnJS(setDragging)(false)
        }),
    [apply, hsv],
  )

  const pureHue = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <View style={styles.root} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <GestureDetector gesture={squarePan}>
            <View style={[styles.square, { width: squareWidth }]}>
              <Canvas style={StyleSheet.absoluteFill}>
                {/* 왼쪽 흰색에서 오른쪽 순색으로 */}
                <Rect x={0} y={0} width={squareWidth} height={SQUARE_HEIGHT}>
                  <LinearGradient start={vec(0, 0)} end={vec(squareWidth, 0)} colors={['#FFFFFF', pureHue]} />
                </Rect>
                {/* 그 위에 아래로 갈수록 검게 */}
                <Rect x={0} y={0} width={squareWidth} height={SQUARE_HEIGHT}>
                  <LinearGradient
                    start={vec(0, 0)}
                    end={vec(0, SQUARE_HEIGHT)}
                    colors={['#00000000', '#000000']}
                  />
                </Rect>
              </Canvas>
              <Handle x={hsv.s * squareWidth} y={(1 - hsv.v) * SQUARE_HEIGHT} color={hsvToHex(hsv)} />
            </View>
          </GestureDetector>

          <GestureDetector gesture={huePan}>
            <View style={styles.hue}>
              <Canvas style={StyleSheet.absoluteFill}>
                <Rect x={0} y={0} width={HUE_WIDTH} height={SQUARE_HEIGHT}>
                  <LinearGradient start={vec(0, 0)} end={vec(0, SQUARE_HEIGHT)} colors={HUE_STOPS} />
                </Rect>
              </Canvas>
              <Handle x={HUE_WIDTH / 2} y={(hsv.h / 360) * SQUARE_HEIGHT} color={pureHue} />
            </View>
          </GestureDetector>
        </>
      )}
    </View>
  )
}

/** 집고 있는 자리. 어떤 색 위에 놓여도 보이게 흰 테두리에 검은 그림자를 준다 */
function Handle({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.handle, { left: x - HANDLE / 2, top: y - HANDLE / 2, backgroundColor: color }]}
    />
  )
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: spacing['150'], height: SQUARE_HEIGHT },
  square: {
    height: SQUARE_HEIGHT,
    borderRadius: cornerRadius['100'],
    overflow: 'hidden',
  },
  hue: {
    width: HUE_WIDTH,
    height: SQUARE_HEIGHT,
    borderRadius: cornerRadius['100'],
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
})
