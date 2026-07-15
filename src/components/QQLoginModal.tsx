import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View } from 'react-native'
import RNFetchBlob from 'rn-fetch-blob'

import Modal, { type ModalType } from '@/components/common/Modal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { createQQQRLogin, getQQAuthStatus, pollQQQRLogin, type QQQRLoginSession } from '@/core/qqAuth'
import { requestStoragePermission, toast } from '@/utils/tools'

export interface QQLoginModalType {
  show: () => void
}

const Header = ({ onClose }: { onClose: () => void }) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={[styles.header, {
      height: 50 + statusBarHeight,
      paddingTop: statusBarHeight,
      backgroundColor: theme['c-content-background'],
    }]}
    >
      <TouchableOpacity onPress={onClose} style={styles.headerButton}>
        <Icon name="chevron-left" size={24} color={theme['c-font']} />
      </TouchableOpacity>
      <Text size={18}>QQ 音乐登录</Text>
      <View style={styles.headerButton} />
    </View>
  )
}

export default forwardRef<QQLoginModalType, {}>((props, ref) => {
  const modalRef = useRef<ModalType>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingRef = useRef(false)
  const sessionRef = useRef<QQQRLoginSession | null>(null)
  const theme = useTheme()
  const [session, setSession] = useState<QQQRLoginSession | null>(null)
  const [message, setMessage] = useState('正在生成登录二维码...')
  const [loading, setLoading] = useState(false)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
    pollingRef.current = false
  }, [])

  const handleClose = useCallback(() => {
    stopPolling()
    modalRef.current?.setVisible(false)
  }, [stopPolling])

  const checkAuthAndClose = useCallback(async () => {
    const status = await getQQAuthStatus()
    if (!status.loggedIn) return false
    global.app_event.qqAuthUpdated(status)
    toast('QQ 音乐登录成功')
    handleClose()
    return true
  }, [handleClose])

  const poll = useCallback(async () => {
    const currentSession = sessionRef.current
    if (!currentSession || pollingRef.current) return
    if (Date.now() > currentSession.expiresAt) {
      stopPolling()
      setMessage('二维码已过期，请刷新后再试')
      return
    }

    pollingRef.current = true
    try {
      const result = await pollQQQRLogin(currentSession.qrsig)
      if (result.status === 'success') {
        stopPolling()
        setMessage('登录成功，正在刷新状态...')
        await checkAuthAndClose()
      } else if (result.status === 'scanned') {
        setMessage('已扫码，请在 QQ 中确认登录')
      } else if (result.status === 'expired') {
        stopPolling()
        setMessage('二维码已过期，请刷新后再试')
      } else if (result.status === 'failed') {
        setMessage('登录检查失败，请刷新二维码后重试')
      } else {
        setMessage('等待使用 QQ 扫码确认')
      }
    } catch {
      setMessage('网络检查失败，稍后会自动重试')
    } finally {
      pollingRef.current = false
    }
  }, [checkAuthAndClose, stopPolling])

  const startPolling = useCallback(() => {
    stopPolling()
    pollTimerRef.current = setInterval(() => { void poll() }, 2500)
    void poll()
  }, [poll, stopPolling])

  const refreshQRCode = useCallback(async () => {
    setLoading(true)
    setMessage('正在生成登录二维码...')
    stopPolling()
    try {
      const nextSession = await createQQQRLogin()
      sessionRef.current = nextSession
      setSession(nextSession)
      setMessage('请用 QQ 扫码；只有一台手机时，先保存二维码到相册，再到 QQ 扫一扫里从相册选择')
      startPolling()
    } catch {
      setSession(null)
      sessionRef.current = null
      setMessage('二维码生成失败，请检查网络后重试')
    } finally {
      setLoading(false)
    }
  }, [startPolling, stopPolling])

  const saveQRCode = useCallback(async () => {
    const currentSession = sessionRef.current
    if (!currentSession) return
    try {
      const isGranted = await requestStoragePermission()
      if (isGranted === false) {
        toast('没有存储权限，无法保存二维码', 'short')
        return
      }

      const baseDir = RNFetchBlob.fs.dirs.PictureDir || RNFetchBlob.fs.dirs.DownloadDir
      const dir = `${baseDir}/LX-Q`
      if (!(await RNFetchBlob.fs.exists(dir))) await RNFetchBlob.fs.mkdir(dir)
      const path = `${dir}/qq-login-qrcode-${Date.now()}.png`
      await RNFetchBlob.fs.writeFile(path, currentSession.imageBase64, 'base64')
      await RNFetchBlob.fs.scanFile([{ path }])
      toast(`二维码已保存到: ${path}`, 'long')
    } catch {
      toast('保存二维码失败，请刷新后重试', 'long')
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      modalRef.current?.setVisible(true)
      void refreshQRCode()
    },
  }), [refreshQRCode])

  useEffect(() => stopPolling, [stopPolling])

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />
        <View style={styles.content}>
          <Text size={14} style={styles.message}>{message}</Text>
          <View style={[styles.qrBox, { borderColor: theme['c-border-background'] }]}>
            {session
              ? <Image source={{ uri: session.imageDataUri }} style={styles.qrImage} />
              : loading
                ? <ActivityIndicator size="large" color={theme['c-primary']} />
                : <Text color={theme['c-font-label']}>请刷新二维码</Text>}
          </View>
          <View style={styles.buttons}>
            <Button onPress={saveQRCode}>保存二维码</Button>
            <Button onPress={refreshQRCode}>刷新二维码</Button>
            <Button onPress={() => { void checkAuthAndClose() }}>我已确认登录</Button>
          </View>
          <Text size={12} style={styles.tip}>
            Cookie 只保存在本机应用沙盒里，不写入日志、设置、备份或同步数据。
          </Text>
        </View>
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: { padding: 5, width: 40 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 16,
  },
  message: { textAlign: 'center' },
  qrBox: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  qrImage: { width: 220, height: 220 },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  tip: { textAlign: 'center', lineHeight: 18 },
})
