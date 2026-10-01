import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, type AlertButton, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'

import { cornerRadius, fonts, motion, spacing } from '@/styles'
import { useTheme } from '@/hooks/theme/ThemeProvider'
import { useBottomSafeGap } from '@/hooks/useBottomSafeGap'
import { PressableScale } from '@/components/foundation/PressableScale'
import { isAppleAvailable, useAuth } from '@/hooks/auth/useAuth'
import { useProfile } from '@/hooks/auth/useProfile'
import { useIsAdmin } from '@/hooks/comment/useIsAdmin'
import { isOwnAvatar } from '@/hooks/auth/avatar'
import { Avatar } from '@/components/profile/Avatar'
import { LinkedAccounts } from '@/components/auth/LinkedAccounts'
import { deleteMyAccount } from '@/repositories/profile/account'
import { forgetLocalFanCards } from '@/hooks/fanCard/useFanCards'

export interface AccountScreenProps {
  onOpenNickname?: () => void
  onOpenHandle?: () => void
  /** 차단한 사용자 목록 */
  onOpenBlocked?: () => void
}

/**
 * 내 계정.
 *
 * 로그아웃을 마이 탭 줄에 바로 달아 두면 닉네임을 보려고 눌렀을 때도 로그아웃
 * 확인창이 떠서 놀란다. 들어와서 고르게 한다.
 */
export function AccountScreen({ onOpenNickname, onOpenHandle, onOpenBlocked }: AccountScreenProps) {
  const theme = useTheme()
  // 들어간 화면에는 탭바가 없다. 하단 바·홈 인디케이터 뒤에 끝이 깔리지 않게 (useBottomSafeGap)
  const bottomGap = useBottomSafeGap()
  const { session, signOut } = useAuth()
  const { profile, saveAvatar, clearAvatar } = useProfile(session)
  // 운영자 이름은 신고 처리·관리자 삭제에 걸려 있어 흔들리면 안 된다. DB 도 막는다(0026)
  const locked = useIsAdmin()
  const [uploading, setUploading] = useState(false)

  const pickAvatar = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('사진 접근이 필요합니다', '설정에서 사진 접근을 켜면 프로필 이미지를 올릴 수 있습니다.')
      return
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // 동그랗게 보여 주므로 고를 때부터 정사각형으로 자르게 한다
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    })
    if (picked.canceled || !picked.assets[0]) return

    setUploading(true)
    try {
      await saveAvatar(picked.assets[0].uri)
    } catch (e) {
      Alert.alert('사진을 올리지 못했습니다', e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }, [saveAvatar])

  // 애플은 iOS 에서만 다룰 수 있다. 안드로이드에서는 연결 목록에서 뺀다
  const [appleReady, setAppleReady] = useState(false)
  useEffect(() => {
    void isAppleAvailable().then(setAppleReady)
  }, [])

  const onAvatarPress = useCallback(() => {
    if (uploading) return
    // 올린 사진이 있을 때만 "치우기" 를 보여 준다. 카카오가 준 사진은 우리가 지울 것이 없다
    const options: AlertButton[] = [{ text: '사진 고르기', onPress: () => void pickAvatar() }]
    if (isOwnAvatar(profile?.avatarUrl ?? null)) {
      options.push({
        text: '사진 치우기',
        style: 'destructive',
        onPress: () => {
          clearAvatar().catch(e => {
            Alert.alert('치우지 못했습니다', e instanceof Error ? e.message : String(e))
          })
        },
      })
    }
    options.push({ text: '취소', style: 'cancel' })
    Alert.alert('프로필 이미지', undefined, options)
  }, [clearAvatar, pickAvatar, profile, uploading])

  const onSignOut = useCallback(() => {
    Alert.alert('로그아웃할까요?', '이 기기에서 로그인이 풀립니다. 카드는 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          signOut().catch(e => {
            Alert.alert('로그아웃하지 못했습니다', e instanceof Error ? e.message : String(e))
          })
        },
      },
    ])
  }, [signOut])

  // 계정 삭제(지침 5.1.1(v)). 되돌릴 수 없으니 한 번 묻는다. 지운 뒤에는 이 기기의 카드도 비우고 나간다
  const [deleting, setDeleting] = useState(false)
  const onDeleteAccount = useCallback(() => {
    if (deleting) return
    Alert.alert(
      '계정을 지울까요?',
      '글·사진·좋아요·팬카드·직관 기록이 모두 지워지고 되돌릴 수 없습니다. 댓글은 "탈퇴한 사용자의 댓글" 로 자리만 남습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계정 삭제',
          style: 'destructive',
          onPress: () => {
            setDeleting(true)
            deleteMyAccount()
              .then(async () => {
                await forgetLocalFanCards()
                await signOut()
                Alert.alert('계정을 지웠습니다', '그동안 포그라운드를 써 주셔서 고맙습니다.')
              })
              .catch(e => Alert.alert('계정을 지우지 못했습니다', e instanceof Error ? e.message : String(e)))
              .finally(() => setDeleting(false))
          },
        },
      ],
    )
  }, [deleting, signOut])

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing['200'] + bottomGap }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatarBlock}>
        <PressableScale
          scaleTo={0.97}
          onPress={onAvatarPress}
          disabled={uploading}
          accessibilityRole="button"
          accessibilityLabel="프로필 이미지 바꾸기"
          style={styles.avatarPress}
        >
          <Avatar url={profile?.avatarUrl ?? null} />
          {uploading && (
            // 사진을 고른 직후 어두운 막이 툭 덮이면 잘못 누른 것처럼 느껴진다
            <Animated.View
              entering={FadeIn.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
              exiting={FadeOut.duration(motion.duration.fast).reduceMotion(ReduceMotion.System)}
              style={[StyleSheet.absoluteFill, styles.avatarBusy]}
            >
              <ActivityIndicator color={theme.textOnMain} />
            </Animated.View>
          )}
        </PressableScale>
        <Text style={[fonts.label, { color: theme.accent }]}>
          {uploading ? '올리는 중' : '프로필 이미지 바꾸기'}
        </Text>
      </View>

      {/* 아이디는 가입할 때 자동으로 받고, 여기서 바꾼다. 운영자는 바꾸지 못한다 */}
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <PressableScale
          scaleTo={0.99}
          onPress={locked ? undefined : onOpenHandle}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`아이디, 현재 ${profile?.handle ?? ''}`}
          style={styles.row}
        >
          <Text style={[fonts.body, { color: theme.textPrimary }]}>아이디</Text>
          <View style={styles.rowRight}>
            <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>
              {profile ? `@${profile.handle}` : ''}
            </Text>
            {!locked && <Text style={[fonts.body, { color: theme.textDisabled }]}>›</Text>}
          </View>
        </PressableScale>
      </View>

      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <PressableScale
          scaleTo={0.99}
          onPress={locked ? undefined : onOpenNickname}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`닉네임, 현재 ${profile?.nickname ?? ''}`}
          style={styles.row}
        >
          <Text style={[fonts.body, { color: theme.textPrimary }]}>닉네임</Text>
          <View style={styles.rowRight}>
            <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>{profile?.nickname ?? ''}</Text>
            {!locked && <Text style={[fonts.body, { color: theme.textDisabled }]}>›</Text>}
          </View>
        </PressableScale>
      </View>

      {locked && (
        <Text style={[fonts.caption, styles.lockNote, { color: theme.textMuted }]}>
          운영자 계정은 아이디와 닉네임을 바꿀 수 없습니다
        </Text>
      )}

      {/* 차단을 푸는 자리. 차단한 사람의 글은 피드에서 빠지므로 글에서는 풀 길을 찾을 수 없다 */}
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <PressableScale
          scaleTo={0.99}
          onPress={onOpenBlocked}
          accessibilityRole="button"
          accessibilityLabel="차단한 사용자"
          style={styles.row}
        >
          <Text style={[fonts.body, { color: theme.textPrimary }]}>차단한 사용자</Text>
          <View style={styles.rowRight}>
            <Text style={[fonts.body, { color: theme.textDisabled }]}>›</Text>
          </View>
        </PressableScale>
      </View>

      {/* 소셜을 이어 두면 어느 것으로 들어와도 같은 계정이다 */}
      <Text style={[fonts.label, styles.sectionTitle, { color: theme.textMuted }]}>연결된 로그인</Text>
      <LinkedAccounts appleReady={appleReady} />

      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <PressableScale
          scaleTo={0.99}
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          style={styles.row}
        >
          <Text style={[fonts.body, { color: theme.loss }]}>로그아웃</Text>
        </PressableScale>
      </View>

      {/* 운영자 계정은 신고 처리·관리자 삭제에 걸려 있어 지우지 않는다. 서버 함수도 막는다 */}
      {!locked && (
        <PressableScale
          scaleTo={0.99}
          onPress={onDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="계정 삭제"
          style={styles.deleteRow}
        >
          <Text style={[fonts.bodySmall, { color: theme.textMuted }]}>
            {deleting ? '지우는 중' : '계정 삭제'}
          </Text>
        </PressableScale>
      )}

      <Text style={[fonts.caption, styles.note, { color: theme.textMuted }]}>
        소셜 계정으로 로그인했습니다. 앱에서 쓰는 닉네임만 여기서 바꿉니다.{'\n'}
        아이디는 다른 사람이 나를 @로 가리킬 때 쓰는 이름입니다.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing['200'], gap: spacing['200'] },
  /** 묶음 위에 붙는 작은 제목. 묶음과 한 덩어리로 보이게 아래 간격을 좁힌다 */
  lockNote: { paddingHorizontal: spacing['050'] },
  sectionTitle: { marginBottom: -spacing['100'], paddingHorizontal: spacing['050'] },
  avatarBlock: { alignItems: 'center', gap: spacing['100'], paddingVertical: spacing['200'] },
  avatarPress: { borderRadius: 36, overflow: 'hidden' },
  avatarBusy: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0008' },
  group: {
    borderRadius: cornerRadius['150'],
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['200'],
    paddingVertical: spacing['200'],
  },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing['100'] },
  note: { textAlign: 'center' },
  /** 잘못 누르지 않게 로그아웃 묶음 밖에 옅게 둔다. 손이 닿는 크기는 지킨다 */
  deleteRow: { alignItems: 'center', paddingVertical: spacing['150'] },
})
