import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
// The namespace declaration `TranslateNS<'crew'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'

const translate = makeTranslate(en)

/** English `crew` translator typed like the one the plugin binds. */
export const t: TranslateNS<'crew'> = (key, params) => translate(key, params)
