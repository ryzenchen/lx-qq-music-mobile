export type SearchType = 'music' | 'songlist' | 'singer' | 'album'

export interface InitState {
  temp_source: LX.OnlineSource
  searchType: SearchType
  searchText: string
  tipListInfo: {
    text: string
    source: LX.OnlineSource
    list: string[]
  }
  historyList: string[]
}

const state: InitState = {
  temp_source: 'tx',
  searchType: 'music',
  searchText: '',
  tipListInfo: {
    text: '',
    source: 'tx',
    list: [],
  },
  historyList: [],
}

export default state
