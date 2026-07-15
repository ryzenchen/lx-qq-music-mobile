import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import WebView from 'react-native-webview'

import Modal, { type ModalType } from '@/components/common/Modal'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { getQQAuthStatus } from '@/core/qqAuth'
import { toast } from '@/utils/tools'

// QQ 音乐网页使用的腾讯官方 OAuth 应用。使用网页账号登录可让授权回调与
// QQ 音乐 Cookie 全程留在同一个 WebView 内，避免跳到外部浏览器后状态丢失。
const LOGIN_URL = 'https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252Fn%252Fryqq_v2%252Fprofile&state=state&display=pc&scope=get_user_info%2Cget_app_friends'
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const OPEN_PASSWORD_LOGIN_SCRIPT = `
  (function openPasswordLogin() {
    var attempts = 0;
    var timer = setInterval(function() {
      attempts += 1;
      var button = document.querySelector('#switcher_plogin, .switcher_plogin');
      if (!button) {
        var links = document.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
          if ((links[i].textContent || '').trim() === '密码登录') {
            button = links[i];
            break;
          }
        }
      }
      if (button) {
        clearInterval(timer);
        button.click();
      } else if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 300);
    true;
  })();
`

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

  return (
    <Modal ref={modalRef} statusBarPadding={false} bgHide={false}>
      <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
        <Header onClose={handleClose} />
        <View style={styles.notice}>
          <Text size={13}>请在下方直接输入 QQ 账号和密码；内容只提交给腾讯官方页面。</Text>
        </View>
        <WebView
          source={{ uri: LOGIN_URL }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          nestedScrollEnabled
          androidLayerType="hardware"
          setSupportMultipleWindows={false}
          injectedJavaScript={OPEN_PASSWORD_LOGIN_SCRIPT}
          injectedJavaScriptForMainFrameOnly={false}
          onShouldStartLoadWithRequest={({ url }) => /^https?:\/\//i.test(url) || url === 'about:blank'}
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
  notice: { paddingHorizontal: 12, paddingVertical: 8 },
})
