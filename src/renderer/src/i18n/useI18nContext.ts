import { useContext } from 'react'
import { I18nContext, type I18nContextValue } from './context'

/**
 * Hook to consume the I18nContext directly.
 * Prefer `useTranslation` from `./useTranslation.ts` for most cases.
 */
export function useI18nContext(): I18nContextValue {
  return useContext(I18nContext)
}
