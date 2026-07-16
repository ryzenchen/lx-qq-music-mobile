import { memo, useCallback, useEffect, useState } from 'react'
import { FlatList, Keyboard, RefreshControl, View } from 'react-native'

import { toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import txUserApi from '@/utils/musicSdk/tx/user'
import ListItem from '../MyPlaylist/ListItem'
import { clearDailyRecPlaylistsCache, getDailyRecPlaylistsCache, setDailyRecPlaylistsCache } from '@/core/cache'

export default memo(({ onOpenDetail }: { onOpenDetail: (info: any) => void }) => {
  const [playlists, setPlaylists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const theme = useTheme()

  const loadPlaylists = useCallback((isRefresh = false) => {
    if (!isRefresh) {
      const cachedPlaylists = getDailyRecPlaylistsCache()
      if (cachedPlaylists) {
        setPlaylists(cachedPlaylists)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    txUserApi.getRecommendPlaylists().then(list => {
      setPlaylists(list)
      setDailyRecPlaylistsCache(list)
    }).catch(err => {
      toast(`获取 QQ 推荐歌单失败: ${err.message}`)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    loadPlaylists()
  }, [loadPlaylists])

  const handleRefresh = () => {
    clearDailyRecPlaylistsCache()
    loadPlaylists(true)
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        onScrollBeginDrag={Keyboard.dismiss}
        data={playlists}
        renderItem={({ item }) => <ListItem item={item} onPress={onOpenDetail} />}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl
            colors={[theme['c-primary']]}
            refreshing={loading}
            onRefresh={handleRefresh}
          />
        }
      />
    </View>
  )
})
