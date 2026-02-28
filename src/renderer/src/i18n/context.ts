import { createContext } from 'react'
import type { Language } from '@renderer/stores/useSettingsStore'
import type { TranslationKey, InterpolationParams } from './types'

/**
 * Context value provided by I18nProvider.
 * Components can use either the `useTranslation` hook (preferred)
 * or this context directly for rare cases.
 */
export interface I18nContextValue {
  language: Language
  t: (key: TranslationKey, params?: InterpolationParams) => string
}

export const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  t: (key) => key,
})
