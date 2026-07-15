import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import WebView from 'react-native-webview'

import Modal, { type ModalType } from '@/components/common/Modal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { getQQAuthStatus, QQ_MUSIC_AUTHORIZE_URL } from '@/core/qqAuth'
import { toast } from '@/utils/tools'

export interface QQLoginModalType {
  show: () => void
}

const QQ_MUSIC_PROFILE_URL = 'https://y.qq.com/n/ryqq_v2/profile'
const QQ_LOGIN_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

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
  const theme = useTheme()
  const [pageKey, setPageKey] = useState(0)
  const [sourceUrl, setSourceUrl] = useState(QQ_MUSIC_AUTHORIZE_URL)
  const [message, setMessage] = useState('请在下方 QQ 音乐官方页面手动登录，完成后点“我已完成登录”。')

  const handleClose = useCallback(() => {
    modalRef.current?.setVisible(false)
  }, [])

  const checkAuthAndClose = useCallback(async (silent = false) => {
    try {
      const status = await getQQAuthStatus()
      if (!status.loggedIn) {
        if (!silent) setMessage('还没有检测到 QQ 音乐登录状态，请先在网页内完成登录/授权，再点“我已完成登录”。')
        return false
      }
      global.app_event.qqAuthUpdated(status)
      toast('QQ 音乐登录成功')
      handleClose()
      return true
    } catch {
      if (!silent) setMessage('登录状态检测失败，请确认网络正常后再试。')
      return false
    }
  }, [handleClose])

  const reloadAuthorizePage = useCallback(() => {
    setSourceUrl(QQ_MUSIC_AUTHORIZE_URL)
    setPageKey(key => key + 1)
    setMessage('已刷新登录页，请在下方官方页面手动登录。')
  }, [])

  const openProfilePage = useCallback(() => {
    setSourceUrl(QQ_MUSIC_PROFILE_URL)
    setPageKey(key => key + 1)
    setMessage('已打开 QQ 音乐个人页；如果页面显示已登录，再点“我已完成登录”。')
  }, [])

  useImperativeHandle(ref, () => ({
    show() {
      setSourceUrl(QQ_MUSIC_AUTHORIZE_URL)
      setPageKey(key => key + 1)
      setMessage('请在下方 QQ 音乐官方页面手动登录，完成后点“我已完成登录”。')
      modalRef.current?.setVisible(true)
    },
  }), [])

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />
        <View style={styles.content}>
          <Text size={14} style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <Button onPress={() => { void checkAuthAndClose() }} style={styles.button}>
              <Text>我已完成登录</Text>
            </Button>
            <Button onPress={reloadAuthorizePage} style={styles.button}>
              <Text>刷新网页登录</Text>
            </Button>
            <Button onPress={openProfilePage} style={styles.button}>
              <Text>打开个人页检测</Text>
            </Button>
          </View>
          <View style={[styles.webViewBox, { borderColor: theme['c-border-background'] }]}>
            <WebView
              key={`${pageKey}-${sourceUrl}`}
              source={{ uri: sourceUrl }}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              userAgent={QQ_LOGIN_USER_AGENT}
              originWhitelist={['*']}
              nestedScrollEnabled
              androidLayerType="hardware"
              onLoadEnd={() => { void checkAuthAndClose(true) }}
              onNavigationStateChange={() => { void checkAuthAndClose(true) }}
              onShouldStartLoadWithRequest={({ url }) => /^https?:\/\//i.test(url) || url === 'about:blank'}
              style={styles.webView}
            />
          </View>
          <Text size={12} style={styles.tip}>
            登录 Cookie 只保存在本机应用沙盒/WebView Cookie 中，不写入日志、设置、备份或同步数据。
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
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  message: { textAlign: 'center' },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  button: { paddingHorizontal: 10, paddingVertical: 6 },
  webViewBox: {
    alignSelf: 'stretch',
    width: '100%',
    flex: 1,
    minHeight: 420,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  webView: { flex: 1, alignSelf: 'stretch' },
  tip: { textAlign: 'center', lineHeight: 18, marginBottom: 10 },
})
