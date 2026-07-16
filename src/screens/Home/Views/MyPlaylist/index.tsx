import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { BackHandler, FlatList, Keyboard, RefreshControl, StyleSheet, View } from 'react-native'

import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { getQQAuthStatus } from '@/core/qqAuth'
import txUserApi from '@/utils/musicSdk/tx/user'
import SonglistDetail from '../../../SonglistDetail'
import { type ListInfoItem } from '@/store/songlist/state'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import ListItem from './ListItem'

import MusicInfoOnline = LX.Music.MusicInfoOnline

export default memo(() => {
  const theme = useTheme()
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<ListInfoItem | null>(null)
  const [scrollToMusicInfo, setScrollToMusicInfo] = useState<MusicInfoOnline | null>(null)
  const selectedPlaylistRef = useRef(selectedPlaylist)
  selectedPlaylistRef.current = selectedPlaylist

  const loadPlaylists = useCallback(async() => {
    setLoading(true)
    try {
      const status = await getQQAuthStatus()
      setLoggedIn(status.loggedIn)
      if (!status.loggedIn) {
        setPlaylists([])
        return
      }
      const list = await txUserApi.getUserPlaylists()
      setPlaylists(list)
    } catch (err: any) {
      toast(`获取 QQ 歌单失败: ${err.message}`)
      setPlaylists([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPlaylists()
    const handleUpdated = () => { void loadPlaylists() }
    global.app_event.on('qqAuthUpdated', handleUpdated)
    return () => {
      global.app_event.off('qqAuthUpdated', handleUpdated)
    }
  }, [loadPlaylists])

  useEffect(() => {
    const handleJumpPosition = () => {
      let listId = playerState.playMusicInfo.listId
      if (listId === LIST_IDS.TEMP) listId = listState.tempListMeta.id
      if (!listId?.startsWith('tx__')) return

      const playlistId = listId.replace('tx__', '')
      const targetPlaylist = playlists.find(p => String(p.id) === playlistId)
      if (!targetPlaylist) return

      const playlistInfo: ListInfoItem = {
        id: String(targetPlaylist.id),
        name: targetPlaylist.name,
        author: targetPlaylist.creator?.nickname,
        img: targetPlaylist.coverImgUrl,
        play_count: targetPlaylist.playCount,
        desc: targetPlaylist.description,
        source: 'tx',
        userId: targetPlaylist.userId,
        total: targetPlaylist.trackCount,
      }
      const musicInfo = 'progress' in playerState.playMusicInfo.musicInfo
        ? playerState.playMusicInfo.musicInfo.metadata.musicInfo
        : playerState.playMusicInfo.musicInfo
      if (musicInfo) setScrollToMusicInfo(musicInfo as MusicInfoOnline)
      setSelectedPlaylist(playlistInfo)
    }

    global.app_event.on('jumpListPosition', handleJumpPosition)
    return () => {
      global.app_event.off('jumpListPosition', handleJumpPosition)
    }
  }, [playlists])

  useEffect(() => {
    const onBackPress = () => {
      if (!selectedPlaylistRef.current) return false
      if (commonState.componentIds.length > 1) return false
      setSelectedPlaylist(null)
      return true
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => subscription.remove()
  }, [])

  const handleItemPress = useCallback((playlistInfo: ListInfoItem) => {
    setSelectedPlaylist({ ...playlistInfo, source: 'tx' })
  }, [])

  const handleBack = useCallback(() => {
    setSelectedPlaylist(null)
    setScrollToMusicInfo(null)
  }, [])

  if (!loggedIn && !loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>请先在设置里登录 QQ 音乐</Text>
        <Button onPress={() => global.app_event.showQQLogin()}>
          <Text>登录 QQ 音乐</Text>
        </Button>
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[{ flex: 1 }, selectedPlaylist ? { opacity: 0 } : null]} pointerEvents={selectedPlaylist ? 'none' : 'auto'}>
        <FlatList
          onScrollBeginDrag={Keyboard.dismiss}
          data={playlists}
          renderItem={({ item }) => <ListItem item={item} onPress={handleItemPress} />}
          keyExtractor={item => String(item.id)}
          refreshControl={
            <RefreshControl
              colors={[theme['c-primary']]}
              refreshing={loading}
              onRefresh={loadPlaylists}
            />
          }
          ListEmptyComponent={!loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>暂时没有读到 QQ 歌单，下拉可重试</Text>
            </View>
          ) : null}
        />
      </View>
      {selectedPlaylist && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme['c-content-background'] }]}>
          <SonglistDetail info={selectedPlaylist} onBack={handleBack} initialScrollToInfo={scrollToMusicInfo} />
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyText: { textAlign: 'center' },
})
