import { getQQAuthCookieHeader, getQQAuthStatus } from '@/core/qqAuth'
import { decodeName, formatPlayCount, toNewMusicInfo } from '../../index'
import songListApi from './songList'

const QQ_MUSIC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const QQ_MUSIC_REFERER = 'https://y.qq.com/portal/profile.html'

interface QQAuthContext {
  cookie: string
  uin: string
}

const parseCookieHeader = (cookie: string) => {
  const result: Record<string, string> = {}
  cookie.split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index <= 0) return
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (name && value) result[name] = value
  })
  return result
}

const normalizeUin = (value?: string) => value?.replace(/^o0*/, '').replace(/\D/g, '') ?? ''

const getAuthContext = async(): Promise<QQAuthContext> => {
  const status = await getQQAuthStatus()
  if (!status.loggedIn) throw new Error('请先登录 QQ 音乐')

  const cookie = await getQQAuthCookieHeader()
  const cookies = parseCookieHeader(cookie)
  const uin = normalizeUin(
    cookies.uin ||
    cookies.qqmusic_uin ||
    cookies.ptui_loginuin ||
    cookies.luin ||
    cookies.pt2gguin ||
    cookies.p_uin ||
    cookies.musicid ||
    cookies.userid,
  )
  if (!cookie || !uin) throw new Error('QQ 音乐登录状态不完整，请重新登录')
  return { cookie, uin }
}

const buildQuery = (data: Record<string, string | number | boolean | undefined>) =>
  Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')

const qqFetchJson = async<T = any>(
  url: string,
  {
    method = 'GET',
    data,
    cookie,
    referer = QQ_MUSIC_REFERER,
    body,
  }: {
    method?: 'GET' | 'POST'
    data?: Record<string, string | number | boolean | undefined>
    cookie?: string
    referer?: string
    body?: string
  } = {},
): Promise<T> => {
  const finalUrl = method === 'GET' && data ? `${url}${url.includes('?') ? '&' : '?'}${buildQuery(data)}` : url
  const resp = await global.fetch(finalUrl, {
    method,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'User-Agent': QQ_MUSIC_UA,
      Referer: referer,
      ...(cookie ? { Cookie: cookie } : null),
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : null),
    },
    ...(method === 'POST' ? { body: body ?? buildQuery(data ?? {}) } : null),
  })
  const text = await resp.text()
  if (!resp.ok) throw new Error(`QQ 音乐请求失败: ${resp.status}`)
  try {
    return JSON.parse(text)
  } catch {
    const jsonp = text.match(/^[^(]*\(([\s\S]*)\)\s*;?$/)
    if (jsonp) return JSON.parse(jsonp[1])
    throw new Error('QQ 音乐返回数据无法解析')
  }
}

const getHomepage = async({ cookie, uin }: QQAuthContext) => {
  const result: any = await qqFetchJson('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', {
    cookie,
    data: {
      cid: 205360838,
      userid: uin,
      reqfrom: 1,
      g_tk: 5381,
      loginUin: uin,
      hostUin: 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    },
  })
  if (result.code === 1000) throw new Error('QQ 音乐登录已失效，请重新登录')
  return result
}

const adaptCreatedPlaylist = (item: any, uin: string) => ({
  id: String(item.tid || item.dissid || item.dirid),
  dirid: item.dirid,
  name: decodeName(item.diss_name || item.dissname || item.name || 'QQ 音乐歌单'),
  coverImgUrl: item.diss_cover || item.logo || item.picurl || 'http://y.gtimg.cn/mediastyle/y/img/cover_qzone_130.jpg',
  trackCount: Number(item.song_cnt ?? item.songnum ?? item.total_song_num ?? 0),
  playCount: formatPlayCount(Number(item.listen_num ?? item.visitnum ?? 0)),
  description: decodeName(item.desc || item.desc_info || '').replace(/<br>/g, '\n'),
  creator: { nickname: item.hostname || item.nickname || 'QQ 音乐' },
  userId: uin,
  source: 'tx',
})

const adaptCollectedPlaylist = (item: any, uin: string) => ({
  id: String(item.dissid || item.tid || item.dirid),
  dirid: item.dirid,
  name: decodeName(item.dissname || item.diss_name || item.title || '收藏歌单'),
  coverImgUrl: item.logo || item.diss_cover || item.picurl,
  trackCount: Number(item.song_cnt ?? item.songnum ?? 0),
  playCount: formatPlayCount(Number(item.visitnum ?? item.listen_num ?? 0)),
  description: decodeName(item.desc || item.desc_info || '').replace(/<br>/g, '\n'),
  creator: { nickname: item.nickname || item.creator?.nick || 'QQ 音乐' },
  userId: uin,
  source: 'tx',
})

const uniqPlaylists = (list: any[]) => {
  const map = new Map<string, any>()
  for (const item of list) {
    if (!item?.id) continue
    if (!map.has(item.id)) map.set(item.id, item)
  }
  return Array.from(map.values())
}

const getCreatedPlaylists = async(ctx: QQAuthContext) => {
  const result: any = await qqFetchJson('https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', {
    cookie: ctx.cookie,
    data: {
      hostUin: 0,
      hostuin: ctx.uin,
      sin: 0,
      size: 200,
      g_tk: 5381,
      loginUin: ctx.uin,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    },
  })
  if (result.code === 1000) throw new Error('QQ 音乐登录已失效，请重新登录')
  if (result.code === 4000) return []
  if (!result.data?.disslist) throw new Error('QQ 音乐歌单返回为空')

  const list = result.data.disslist.map((item: any) => adaptCreatedPlaylist(item, ctx.uin))
  if (!list.some((item: any) => Number(item.dirid) === 201)) {
    try {
      const home = await getHomepage(ctx)
      const fav = home?.data?.mymusic?.[0]
      if (fav?.id) {
        list.unshift(adaptCreatedPlaylist({
          diss_name: '我喜欢',
          diss_cover: 'http://y.gtimg.cn/mediastyle/global/img/cover_like.png',
          song_cnt: fav.num0,
          listen_num: 0,
          dirid: 201,
          tid: fav.id,
          hostname: home?.data?.creator?.nick,
        }, ctx.uin))
      }
    } catch {
      // “我喜欢”入口获取失败时保留其他歌单，不暴露登录细节。
    }
  }
  return list
}

const getCollectedPlaylists = async(ctx: QQAuthContext) => {
  const result: any = await qqFetchJson('https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', {
    cookie: ctx.cookie,
    data: {
      ct: 20,
      cid: 205360956,
      userid: ctx.uin,
      reqtype: 3,
      sin: 0,
      ein: 99,
      g_tk: 5381,
      loginUin: ctx.uin,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    },
  })
  if (result.code === 1000) throw new Error('QQ 音乐登录已失效，请重新登录')
  return (result.data?.cdlist ?? []).map((item: any) => adaptCollectedPlaylist(item, ctx.uin))
}

const parseDailyPlaylistId = (html: string) => {
  const privateShare = html.match(/<li[\s\S]*?今日私享[\s\S]*?data-rid=["']?(\d+)/)
  if (privateShare?.[1]) return privateShare[1]
  const personal = html.match(/<li[\s\S]*?(?:每日|推荐|私享)[\s\S]*?data-rid=["']?(\d+)/)
  if (personal?.[1]) return personal[1]
  return ''
}

const getPlaylistDetailWithCookie = async(id: string, cookie: string) => {
  const result: any = await qqFetchJson('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
    cookie,
    referer: `https://y.qq.com/n/yqq/playsquare/${id}.html`,
    data: {
      type: 1,
      json: 1,
      utf8: 1,
      onlysong: 0,
      new_format: 1,
      disstid: id,
      loginUin: 0,
      hostUin: 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    },
  })
  if (result.code !== 0) throw new Error(result.msg || 'QQ 音乐歌单详情获取失败')
  const cdlist = result.cdlist?.[0]
  if (!cdlist?.songlist) throw new Error('QQ 音乐歌单没有歌曲')
  return {
    list: (await songListApi.filterListDetail(cdlist.songlist))
      .map((item: any) => toNewMusicInfo(item) as LX.Music.MusicInfoOnline),
    info: cdlist,
  }
}

const getFallbackRecommendSongs = async() => {
  const result: any = await qqFetchJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    data: {
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      data: JSON.stringify({
        comm: { ct: 24 },
        recomPlaylist: {
          method: 'get_hot_recommend',
          param: { async: 1, cmd: 2 },
          module: 'playlist.HotRecommendServer',
        },
      }),
    },
  })
  const first = result.recomPlaylist?.data?.v_hot?.[0]
  if (!first?.content_id) throw new Error('QQ 音乐暂时没有返回推荐歌曲')
  const detail = await songListApi.getListDetail(String(first.content_id))
  return detail.list
    .slice(0, 30)
    .map((item: any) => toNewMusicInfo(item) as LX.Music.MusicInfoOnline)
}

export default {
  async getUserPlaylists() {
    const ctx = await getAuthContext()
    const [created, collected] = await Promise.all([
      getCreatedPlaylists(ctx),
      getCollectedPlaylists(ctx).catch(() => []),
    ])
    return uniqPlaylists([...created, ...collected])
  },

  async getDailySongs() {
    const ctx = await getAuthContext()
    try {
      const resp = await global.fetch('https://c.y.qq.com/node/musicmac/v6/index.html', {
        headers: {
          'User-Agent': QQ_MUSIC_UA,
          Referer: 'https://y.qq.com/',
          Cookie: ctx.cookie,
        },
      })
      const html = await resp.text()
      const id = parseDailyPlaylistId(html)
      if (id) {
        const detail = await getPlaylistDetailWithCookie(id, ctx.cookie)
        return { list: detail.list, source: 'tx', listId: id }
      }
    } catch {
      // 降级到 QQ 推荐歌单里的歌曲，保证页面可测。
    }
    return { list: await getFallbackRecommendSongs(), source: 'tx', listId: 'qq_recommend_fallback' }
  },

  async getRecommendPlaylists() {
    const result: any = await qqFetchJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      data: {
        format: 'json',
        inCharset: 'utf-8',
        outCharset: 'utf-8',
        data: JSON.stringify({
          comm: { ct: 24 },
          recomPlaylist: {
            method: 'get_hot_recommend',
            param: { async: 1, cmd: 2 },
            module: 'playlist.HotRecommendServer',
          },
        }),
      },
    })
    return (result.recomPlaylist?.data?.v_hot ?? []).map((item: any) => ({
      id: String(item.content_id || item.tid || item.id),
      name: decodeName(item.title || item.name || 'QQ 音乐推荐歌单'),
      trackCount: Number(item.song_num ?? item.song_count ?? 0),
      coverImgUrl: item.cover || item.cover_url_big || item.picurl,
      creator: { nickname: item.username || item.creator?.nick || 'QQ 音乐推荐' },
      playCount: formatPlayCount(Number(item.listen_num ?? item.access_num ?? 0)),
      description: decodeName(item.rcmdcontent || item.desc || '').replace(/<br>/g, '\n'),
      source: 'tx',
    })).filter((item: any) => item.id && item.coverImgUrl)
  },
}
