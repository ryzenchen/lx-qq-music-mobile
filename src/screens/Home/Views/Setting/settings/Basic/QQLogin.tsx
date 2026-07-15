import { memo, useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import Button from '../../components/Button'
import Text from '@/components/common/Text'
import { clearQQAuth, getQQAuthStatus, type QQAuthStatus } from '@/core/qqAuth'
import { createStyle, toast } from '@/utils/tools'

const LOGGED_OUT: QQAuthStatus = { loggedIn: false, accountHint: null, loginType: null }

export default memo(() => {
  const [status, setStatus] = useState<QQAuthStatus>(LOGGED_OUT)

  const refreshStatus = useCallback(() => {
    void getQQAuthStatus().then(setStatus).catch(() => setStatus(LOGGED_OUT))
  }, [])

  useEffect(() => {
    refreshStatus()
    const handleUpdated = (nextStatus: QQAuthStatus) => setStatus(nextStatus)
    global.app_event.on('qqAuthUpdated', handleUpdated)
    return () => global.app_event.off('qqAuthUpdated', handleUpdated)
  }, [refreshStatus])

  const handleLogin = () => global.app_event.showQQLogin()
  const handleLogout = () => {
    void clearQQAuth().then(() => {
      setStatus(LOGGED_OUT)
      global.app_event.qqAuthUpdated(LOGGED_OUT)
      toast('已退出 QQ 音乐登录')
    }).catch(() => toast('退出登录失败，请重试', 'long'))
  }

  return (
    <View style={styles.content}>
      <Text>{status.loggedIn ? `QQ 音乐：已登录（${status.accountHint ?? '账号'}）` : 'QQ 音乐：未登录'}</Text>
      <Text size={12}>登录票据仅保存在本机应用沙盒，不进入备份、同步或日志。</Text>
      <View style={styles.buttons}>
        <Button onPress={status.loggedIn ? handleLogout : handleLogin}>
          {status.loggedIn ? '退出登录' : '登录 QQ 音乐'}
        </Button>
        {status.loggedIn ? <Button onPress={refreshStatus}>刷新状态</Button> : null}
      </View>
    </View>
  )
})

const styles = createStyle({
  content: { paddingHorizontal: 20, paddingBottom: 10, gap: 6 },
  buttons: { flexDirection: 'row', gap: 8 },
})
