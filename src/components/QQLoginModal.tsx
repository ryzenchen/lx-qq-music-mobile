import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native'
import WebView, { type WebViewNavigation } from 'react-native-webview'

import Modal, { type ModalType } from '@/components/common/Modal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { getQQAuthStatus } from '@/core/qqAuth'
import { toast } from '@/utils/tools'

// QQ 音乐网页使用的腾讯官方 OAuth 应用。移动展示模式可唤起本机 QQ，
// 同时保留腾讯页面提供的账号登录方式，不需要另一台手机扫码。
const LOGIN_URL = 'https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252Fn%252Fryqq_v2%252Fprofile&state=state&display=mobile&scope=get_user_info%2Cget_app_friends'
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

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
  const loggedInRef = useRef(false)
  const checkingRef = useRef(false)
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    show() {
      loggedInRef.current = false
      checkingRef.current = false
      modalRef.current?.setVisible(true)
    },
  }))

  const handleClose = useCallback(() => modalRef.current?.setVisible(false), [])

  const checkLoginStatus = useCallback(async () => {
    if (loggedInRef.current || checkingRef.current) return
    checkingRef.current = true
    try {
      const status = await getQQAuthStatus()
      if (!status.loggedIn) return
      loggedInRef.current = true
      global.app_event.qqAuthUpdated(status)
      toast('QQ 音乐登录成功')
      handleClose()
    } catch {
      // 页面跳转期间检查失败属于正常状态，不记录 Cookie 或请求细节。
    } finally {
      checkingRef.current = false
    }
  }, [handleClose])

  const handleNavigation = useCallback((request: WebViewNavigation) => {
    const url = request.url
    if (/^https?:\/\//i.test(url) || url === 'about:blank') return true

    // 腾讯登录页的一键登录会使用 QQ 的应用协议。只交给 Android 系统处理，
    // 不读取、转发或记录协议中的任何登录参数。
    if (/^(mqqapi|mqqopensdkapi|wtloginmqq):\/\//i.test(url)) {
      void Linking.openURL(url).catch(() => toast('未能打开 QQ，请确认已安装最新版 QQ'))
    }
    return false
  }, [])

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />
        <WebView
          source={{ uri: LOGIN_URL }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={handleNavigation}
          onLoadEnd={() => { void checkLoginStatus() }}
          onNavigationStateChange={() => { void checkLoginStatus() }}
          userAgent={MOBILE_USER_AGENT}
        />
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
})
