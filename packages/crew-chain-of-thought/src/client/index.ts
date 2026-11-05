/** Register the chain-of-thought Definition, its copy and its Chat renderer. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ChainCard } from './ChainCard.tsx'
import { chainDefinition } from './chain.ts'
import { en, zh, type ChainKey } from './locales.ts'

export { chainDefinition, detailOf, sourcesOf, thoughtOf, type ChainData, type ChainStep } from './chain.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewChain: ChainKey }
}

/** Services the card needs. */
export const inject = ['uiConversation', 'slots', 'locale']

/**
 * Register the Definition, copy and keyed renderer.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.uiConversation.events.register(chainDefinition), 'crew-chain-of-thought: definition')
  ctx.effect(() => ctx.locale.register('crewChain', { en, zh }), 'crew-chain-of-thought: locale')
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node', key: 'crew-chain', locale: 'crewChain',
  }, ChainCard))
}
