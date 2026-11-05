/**
 * The preset row that gives one crew member its approved lessons: a system-prompt section scoped to the preset's Agents.
 * @module @deepseek-ai/dsh-experimental-crew-improve/lessons
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from './index.ts'

export const name = 'crew-lessons'

/** The learning service and the prompt registry this row contributes to. */
export const inject = ['crewImprove', 'systemPrompt']

/** Section order: after tool guidance, before the environment suffix. */
export const LESSONS_ORDER = 9500

/** Row config. */
export interface Config {
  /** Crew member (preset id) whose lessons this preset reads. */
  member: string
}

/** Runtime config schema. */
export const Config: z<Config> = z.object({
  member: z.string().pattern(/^crew-[a-z]+$/).required(),
})

/**
 * Add the member's lessons to its system prompt.
 * @param ctx - the crew preset scope.
 * @param config - the member whose lessons to read.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'crew-lessons',
    order: LESSONS_ORDER,
    interpolate: false,
    text: () => ctx.crewImprove.section(config.member),
  }), 'crew-lessons')
}
