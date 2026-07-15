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

const LOGIN_URL = 'https://y.qq.com/n/ryqq/profile'
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// QQ 音乐移动首页不提供稳定登录入口，使用桌面个人中心并触发其官方登录按钮。
// 脚本不读取页面 Cookie、账号或表单内容。
const OPEN_LOGIN_SCRIPT = `
  (function openQQMusicLogin() {
    if (window.__lxqLoginOpened) return true;
    var findLoginButton = function() {
      var selectors = [
        '.top_login__link',
        '.js_login',
        '[data-stat="y_new.top.login"]',
        'a[href*="login"]'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var button = document.querySelector(selectors[i]);
        if (button) return button;
      }
      var candidates = document.querySelectorAll('a, button, span');
      for (var j = 0; j < candidates.length; j++) {
        if ((candidates[j].textContent || '').trim() === '登录') return candidates[j];
      }
      return null;
    };
    var attempts = 0;
    var timer = setInterval(function() {
      attempts += 1;
      var button = findLoginButton();
      if (button) {
        window.__lxqLoginOpened = true;
        clearInterval(timer);
        button.click();
      } else if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 500);
    return true;
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
      // 登录页面加载过程中检查失败是正常状态，不记录 Cookie 或请求细节。
    } finally {
      checkingRef.current = false
    }
  }, [handleClose])

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
          setSupportMultipleWindows={false}
          injectedJavaScript={OPEN_LOGIN_SCRIPT}
          onLoadEnd={() => { void checkLoginStatus() }}
          onNavigationStateChange={() => { void checkLoginStatus() }}
          userAgent={DESKTOP_USER_AGENT}
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
