import CookieManager, { type Cookies } from '@react-native-cookies/cookies'

const QQ_MUSIC_ORIGIN = 'https://y.qq.com'

// 仅允许 QQ 音乐账号 API 所需字段进入应用内存，避免采集无关 Cookie。
const QQ_AUTH_COOKIE_NAMES = [
  'uin',
  'qqmusic_uin',
  'qm_keyst',
  'wxunionid',
  'wxrefresh_token',
] as const

type QQAuthCookieName = (typeof QQ_AUTH_COOKIE_NAMES)[number]

export interface QQAuthStatus {
  loggedIn: boolean
  accountHint: string | null
  loginType: 'qq' | 'wechat' | null
}

const getAllowedCookies = async (): Promise<Partial<Record<QQAuthCookieName, string>>> => {
  const cookies: Cookies = await CookieManager.get(QQ_MUSIC_ORIGIN, true)
  const allowed: Partial<Record<QQAuthCookieName, string>> = {}
  for (const name of QQ_AUTH_COOKIE_NAMES) {
    const value = cookies[name]?.value
    if (value) allowed[name] = value
  }
  return allowed
}

const normalizeUin = (value?: string) => value?.replace(/^o0*/, '') ?? ''

export const getQQAuthStatus = async (): Promise<QQAuthStatus> => {
  const cookies = await getAllowedCookies()
  const qqUin = normalizeUin(cookies.uin || cookies.qqmusic_uin)
  const isQQLogin = Boolean(cookies.qm_keyst && qqUin && qqUin !== '0')
  const isWechatLogin = Boolean(cookies.wxunionid && cookies.wxrefresh_token)

  return {
    loggedIn: isQQLogin || isWechatLogin,
    accountHint: isQQLogin && qqUin ? `QQ 尾号 ${qqUin.slice(-4)}` : isWechatLogin ? '微信账号' : null,
    loginType: isQQLogin ? 'qq' : isWechatLogin ? 'wechat' : null,
  }
}

/**
 * 仅在发起 QQ 音乐账号请求时调用。返回值不得写入日志、设置、备份或同步数据。
 */
export const getQQAuthCookieHeader = async (): Promise<string> => {
  const cookies = await getAllowedCookies()
  return QQ_AUTH_COOKIE_NAMES
    .map(name => cookies[name] ? `${name}=${cookies[name]}` : '')
    .filter(Boolean)
    .join('; ')
}

export const clearQQAuth = async () => {
  await Promise.all(
    QQ_AUTH_COOKIE_NAMES.map(async name => {
      try {
        await CookieManager.clearByName(QQ_MUSIC_ORIGIN, name, true)
      } catch {
        // 某些 Android WebView 版本不支持删除不存在的 Cookie，忽略即可。
      }
    }),
  )
  await CookieManager.flush()
}
