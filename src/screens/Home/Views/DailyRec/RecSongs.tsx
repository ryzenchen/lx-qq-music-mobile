import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import { toast } from '@/utils/tools'
import { useI18n } from '@/lang'
import { autoSaveDailyPlaylist, handlePlay } from './listAction'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { getDailyRecSongsCache, setDailyRecSongsCache, clearDailyRecSongsCache } from '@/core/cache'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import { LIST_IDS } from '@/config/constant'
import txUserApi from '@/utils/musicSdk/tx/user'

import type { StylizedSelection } from './StylizedModal'

interface RecSongsProps {
  isStylized?: boolean
  stylizedSelection?: StylizedSelection | null
}

export default memo(({ isStylized }: RecSongsProps) => {
  const listRef = useRef<OnlineListType>(null)
  const [isLoading, setIsLoading] = useState(true)
  const t = useI18n()
  const playerMusicInfo = usePlayerMusicInfo()

  useEffect(() => {
    const handleJumpPosition = () => {
      const listId = playerState.playMusicInfo.listId === LIST_IDS.TEMP
        ? listState.tempListMeta.id
        : playerState.playMusicInfo.listId

      if (!listId?.startsWith('dailyrec_tx')) return

      const musicInfo = playerState.playMusicInfo.musicInfo
      if (musicInfo) {
        listRef.current?.scrollToInfo(musicInfo as LX.Music.MusicInfoOnline)
      }
    }

    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [])

  const loadSongs = useCallback((useCache = true) => {
    if (isStylized) {
      toast('QQ 音乐暂未接入风格化每日推荐，已加载默认推荐')
    }
    const cachedSongs = useCache ? getDailyRecSongsCache() : null
    if (cachedSongs) {
      setTimeout(() => {
        listRef.current?.setList(cachedSongs, false)
        listRef.current?.setStatus('idle')
        setIsLoading(false)
      }, 0)
      return
    }

    setIsLoading(true)
    listRef.current?.setStatus('loading')
    txUserApi.getDailySongs().then(result => {
      listRef.current?.setList(result.list, false)
      listRef.current?.setStatus('idle')
      setDailyRecSongsCache(result.list)
      if (result.list?.length) void autoSaveDailyPlaylist(result.list)
    }).catch(err => {
      toast(`获取 QQ 推荐歌曲失败: ${err.message || t('load_failed')}`, 'long')
      listRef.current?.setStatus('error')
    }).finally(() => {
      setIsLoading(false)
    })
  }, [isStylized, t])

  useEffect(() => {
    loadSongs(true)
  }, [loadSongs])

  const handleRefresh = useCallback(() => {
    clearDailyRecSongsCache()
    listRef.current?.setStatus('refreshing')
    loadSongs(false)
  }, [loadSongs])

  return (
    <View style={{ flex: 1 }}>
      <OnlineList
        ref={listRef}
        listId="dailyrec_tx"
        forcePlayList={true}
        playingId={playerMusicInfo.id}
        onPlayList={(index) => {
          const list = listRef.current?.getList()
          if (!list) return
          handlePlay(list, index, 'dailyrec_tx')
        }}
        onRefresh={handleRefresh}
        onLoadMore={() => {}}
        checkHomePagerIdle
      />
    </View>
  )
})
