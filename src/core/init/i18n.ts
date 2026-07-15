import { createI18n } from '@/lang/i18n'
import type { I18n } from '@/lang/i18n'
import { getDeviceLanguage } from '@/utils/tools'
import { setLanguage, updateSetting } from '@/core/common'

const normalizeDeviceLanguage = (deviceLanguage: unknown): I18n['locale'] | null => {
  if (typeof deviceLanguage != 'string') return null

  const language = deviceLanguage.toLowerCase().replace(/_/g, '-')
  if (language.startsWith('zh-hant') || /(^|-)tw($|-)|(^|-)hk($|-)|(^|-)mo($|-)/.test(language)) {
    return 'zh_tw'
  }
  if (language.startsWith('zh')) return 'zh_cn'
  if (language.startsWith('en')) return 'en_us'
  return null
}

export default async (setting: LX.AppSetting) => {
  let lang = setting['common.langId']

  global.i18n = createI18n()

  if (!lang || !global.i18n.availableLocales.includes(lang)) {
    const deviceLanguage = normalizeDeviceLanguage(await getDeviceLanguage())
    lang = deviceLanguage ?? global.i18n.fallbackLocale
    updateSetting({ 'common.langId': lang })
  }
  setLanguage(lang)
}
