import CookieManager, { type Cookies } from '@react-native-cookies/cookies'
import RNFetchBlob from 'rn-fetch-blob'

const QQ_MUSIC_ORIGIN = 'https://y.qq.com'
const QQ_MUSIC_COOKIE_URL = 'https://y.qq.com/'
const QQ_GRAPH_COOKIE_URL = 'https://graph.qq.com/'
const QQ_PTLOGIN_COOKIE_URL = 'https://ssl.ptlogin2.qq.com/'
const QQ_QR_SHOW_API = 'https://ssl.ptlogin2.qq.com/ptqrshow'
const QQ_QR_CHECK_API = 'https://ssl.ptlogin2.qq.com/ptqrlogin'
const QQ_LOGIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
export const QQ_MUSIC_AUTHORIZE_URL = 'https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D1%26surl%3Dhttps%253A%252F%252Fy.qq.com%252Fn%252Fryqq_v2%252Fprofile&state=state&display=pc&scope=get_user_info%2Cget_app_friends'

// 仅允许 QQ 音乐账号 API 所需字段进入应用内存，避免采集无关 Cookie。
const QQ_AUTH_COOKIE_NAMES = [
  'uin',
  'qqmusic_uin',
  'musicid',
  'userid',
  'ptui_loginuin',
  'luin',
  'pt2gguin',
  'p_uin',
  'qm_keyst',
  'qqmusic_key',
  'p_skey',
  'skey',
  'musickey',
  'wxunionid',
  'wxrefresh_token',
] as const

type QQAuthCookieName = (typeof QQ_AUTH_COOKIE_NAMES)[number]

export interface QQAuthStatus {
  loggedIn: boolean
  accountHint: string | null
  loginType: 'qq' | 'wechat' | null
}

export interface QQQRLoginSession {
  imageDataUri: string
  imageBase64: string
  qrsig: string
  expiresAt: number
}

export type QQQRLoginPollStatus = 'waiting' | 'scanned' | 'success' | 'expired' | 'failed'

export interface QQQRLoginPollResult {
  status: QQQRLoginPollStatus
  message: string
  redirectUrl?: string
  callbackUrls?: string[]
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

const firstNonEmpty = (...values: Array<string | undefined>) => {
  for (const value of values) {
    if (value?.trim()) return value.trim()
  }
  return ''
}

const normalizeUin = (value?: string) => value?.replace(/^o0*/, '') ?? ''

const getHeader = (headers: Record<string, string>, name: string) => {
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value
  }
  return ''
}

const parseSetCookie = (headers: Record<string, string>) => {
  const value = getHeader(headers, 'set-cookie')
  if (!value) return {}
  const result: Record<string, string> = {}
  const cookieStrings = value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g)
  for (const cookieString of cookieStrings) {
    const [pair] = cookieString.split(';')
    const index = pair.indexOf('=')
    if (index <= 0) continue
    const name = pair.slice(0, index).trim()
    const cookieValue = pair.slice(index + 1).trim()
    if (name && cookieValue) result[name] = cookieValue
  }
  return result
}

const joinCookieMap = (cookies: Record<string, string>) =>
  Object.keys(cookies)
    .sort()
    .map(name => `${name}=${cookies[name]}`)
    .join('; ')

const hash33 = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash += (hash << 5) + value.charCodeAt(i)
  }
  return hash & 0x7fffffff
}

const parseQQQRCheck = (raw: string) => {
  const matches = [...raw.matchAll(/'([^']*)'/g)].map(match => match[1])
  return {
    code: matches[0] ?? '',
    redirectUrl: matches[2] ?? '',
    message: matches[4] ?? raw,
  }
}

const mapQQQRStatus = (code: string): QQQRLoginPollStatus => {
  switch (code) {
    case '0':
      return 'success'
    case '65':
      return 'expired'
    case '66':
      return 'waiting'
    case '67':
      return 'scanned'
    default:
      return 'failed'
  }
}

const normalizeQQMusicCookies = (cookies: Record<string, string>) => {
  const result = { ...cookies }
  result.uin ||= result.ptui_loginuin || result.luin || result.pt2gguin || result.superuin || result.p_uin || result.musicid || result.userid || result.wxuin
  result.qqmusic_key ||= result.p_skey || result.skey || result.musickey
  result.qm_keyst ||= result.qqmusic_key
  return result
}

const setCookieMap = async (url: string, cookies: Record<string, string>) => {
  for (const [name, value] of Object.entries(cookies)) {
    if (!name || !value) continue
    await CookieManager.set(url, {
      name,
      value,
      domain: new URL(url).hostname,
      path: '/',
      version: '1',
    }, true)
  }
}

const setCookieMapEverywhere = async (cookies: Record<string, string>) => {
  const normalized = normalizeQQMusicCookies(cookies)
  await setCookieMap(QQ_MUSIC_COOKIE_URL, normalized)
  await setCookieMap(QQ_GRAPH_COOKIE_URL, normalized)
  await setCookieMap(QQ_PTLOGIN_COOKIE_URL, normalized)
  await setCookieMap('https://qq.com/', normalized)
  await setCookieMap('https://music.qq.com/', normalized)
}

const followQQRedirectCookies = async (redirectUrl: string, cookies: Record<string, string>) => {
  let currentUrl = redirectUrl.trim()
  let referer = QQ_MUSIC_COOKIE_URL
  const collected = { ...cookies }

  for (let i = 0; i < 8 && currentUrl; i++) {
    const resp = await RNFetchBlob.config({ followRedirect: false }).fetch('GET', currentUrl, {
      'User-Agent': QQ_LOGIN_UA,
      Referer: referer,
      Cookie: joinCookieMap(collected),
    })
    Object.assign(collected, parseSetCookie(resp.info().headers as Record<string, string>))
    const status = resp.info().status
    const location = getHeader(resp.info().headers as Record<string, string>, 'location')
    if (!location || status < 300 || status >= 400) break
    referer = currentUrl
    currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString()
  }

  return collected
}

export const createQQQRLogin = async (): Promise<QQQRLoginSession> => {
  const params = new URLSearchParams({
    appid: '716027609',
    e: '2',
    l: 'M',
    s: '3',
    d: '72',
    v: '4',
    t: (Date.now() / 1000).toFixed(17),
    daid: '383',
    pt_3rd_aid: '100497308',
  })
  const resp = await RNFetchBlob.config({ fileCache: false }).fetch('GET', `${QQ_QR_SHOW_API}?${params.toString()}`, {
    'User-Agent': QQ_LOGIN_UA,
    Referer: QQ_MUSIC_COOKIE_URL,
  })
  const qrsig = parseSetCookie(resp.info().headers as Record<string, string>).qrsig
  if (!qrsig) throw new Error('无法生成 QQ 登录二维码')
  const imageBase64 = resp.base64()
  return {
    imageBase64,
    imageDataUri: `data:image/png;base64,${imageBase64}`,
    qrsig,
    expiresAt: Date.now() + 2 * 60 * 1000,
  }
}

export const pollQQQRLogin = async (qrsig: string): Promise<QQQRLoginPollResult> => {
  const params = new URLSearchParams({
    u1: 'https://graph.qq.com/oauth2.0/login_jump',
    ptqrtoken: String(hash33(qrsig)),
    ptredirect: '100',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: `0-0-${Date.now()}`,
    js_ver: '21072115',
    js_type: '1',
    login_sig: '',
    pt_uistyle: '40',
    aid: '716027609',
    daid: '383',
    pt_3rd_aid: '100497308',
    has_onekey: '1',
    pttype: '1',
    service: 'ptqrlogin',
    nodirect: '0',
  })
  const resp = await RNFetchBlob.config({ followRedirect: false }).fetch('GET', `${QQ_QR_CHECK_API}?${params.toString()}`, {
    'User-Agent': QQ_LOGIN_UA,
    Referer: 'https://xui.ptlogin2.qq.com/',
    Cookie: `qrsig=${qrsig}`,
  })
  const raw = await resp.text()
  const parsed = parseQQQRCheck(raw)
  const status = mapQQQRStatus(parsed.code)
  if (status !== 'success') return { status, message: parsed.message }

  let callbackUrls = parsed.redirectUrl ? [parsed.redirectUrl, QQ_MUSIC_AUTHORIZE_URL, QQ_MUSIC_COOKIE_URL] : [QQ_MUSIC_AUTHORIZE_URL, QQ_MUSIC_COOKIE_URL]
  try {
    let cookies = parseSetCookie(resp.info().headers as Record<string, string>)
    if (parsed.redirectUrl) cookies = await followQQRedirectCookies(parsed.redirectUrl, cookies)
    await setCookieMapEverywhere(cookies)
    await setCookieMap(QQ_PTLOGIN_COOKIE_URL, { qrsig })
    await CookieManager.flush()
  } catch {
    // The callback WebView below is the source of truth if manual cookie handoff fails.
  }
  callbackUrls = Array.from(new Set(callbackUrls.filter(Boolean)))
  return { status: 'success', message: parsed.message || '登录成功', redirectUrl: parsed.redirectUrl, callbackUrls }
}

export const getQQAuthStatus = async (): Promise<QQAuthStatus> => {
  const cookies = await getAllowedCookies()
  const qqUin = normalizeUin(firstNonEmpty(
    cookies.uin,
    cookies.qqmusic_uin,
    cookies.musicid,
    cookies.userid,
    cookies.ptui_loginuin,
    cookies.luin,
    cookies.pt2gguin,
    cookies.p_uin,
  ))
  const musicKey = firstNonEmpty(
    cookies.qm_keyst,
    cookies.qqmusic_key,
    cookies.musickey,
    cookies.p_skey,
    cookies.skey,
  )
  const isQQLogin = Boolean(musicKey && qqUin && qqUin !== '0')
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

export const flushQQAuthCookies = async () => {
  await CookieManager.flush()
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
