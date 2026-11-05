import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
// The namespace declaration `TranslateNS<'crew'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import type { RosterEntry } from '../src/roster.ts'

const translate = makeTranslate(en)

/** English `crew` translator typed like the one the plugin binds. */
export const t: TranslateNS<'crew'> = (key, params) => translate(key, params)

/** The shipped crew as the roster sees it, in roster order. */
export const ENTRIES = [
  { id: 'crew-chief', name: 'Chief of staff', face: { body: 'orb', color: '#0B0B0C' } },
  { id: 'crew-mail', name: 'Mail', face: { body: 'block', color: '#E8B4A0' } },
  { id: 'crew-chat', name: 'Chat', face: { body: 'bean', color: '#C9B6E4' } },
  { id: 'crew-code', name: 'Code', face: { body: 'drop', color: '#4D6BFE' } },
  { id: 'crew-research', name: 'Research', face: { body: 'orb', color: '#A8C7A1' } },
  { id: 'crew-life', name: 'Life', face: { body: 'bean', color: '#F2D16B' } },
] as const satisfies readonly RosterEntry[]
