/**
 * Fold one Turn's reasoning, tool calls and results into a chain-of-thought Chat node, live while the Turn runs.
 * Everything comes from the Session log, so replaying a Session rebuilds the same card.
 */
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatConversationViewNode } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

/** One row of the chain. */
export type ChainStep =
  | { readonly kind: 'thought'; readonly key: string; readonly text: string }
  | {
    readonly kind: 'tool'
    readonly key: string
    readonly name: string
    /** The argument that best names what the tool was asked, such as a query, URL or command. */
    readonly detail?: string
    readonly startedAt: number
    readonly endedAt?: number
    readonly failed?: boolean
    /** Hosts of the links the result contained, in first-seen order. */
    readonly sources: readonly string[]
  }

/** Rendered payload of one Turn's card. */
export interface ChainData {
  readonly turn: number
  readonly startedAt: number
  readonly endedAt?: number
  readonly steps: readonly ChainStep[]
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** One Turn's chain of thought. */
    'crew-chain': ChainData
  }
}

/** Arguments that describe a call, in preference order. */
const DETAIL_KEYS = ['query', 'q', 'url', 'command', 'cmd', 'description', 'prompt', 'path', 'symbol', 'pattern'] as const
const MAX_DETAIL = 80
const MAX_SOURCES = 6
const MAX_THOUGHT = 140

/**
 * The argument worth showing for a call.
 * @param raw - the call's raw JSON arguments.
 * @returns a trimmed single line, or undefined.
 */
export function detailOf(raw: string): string | undefined {
  let args: unknown
  try { args = JSON.parse(raw) } catch { return undefined }
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return undefined
  const record = args as Record<string, unknown>
  for (const key of DETAIL_KEYS) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') {
      const line = value.trim().split('\n')[0] ?? ''
      return line.length > MAX_DETAIL ? `${line.slice(0, MAX_DETAIL - 1)}…` : line
    }
  }
  return undefined
}

/**
 * Hosts of the http(s) links in a tool result's text.
 * @param content - result content blocks.
 * @returns distinct hosts, at most six.
 */
export function sourcesOf(content: readonly ContentBlock[]): readonly string[] {
  const hosts: string[] = []
  for (const block of content) {
    if (block.type !== 'text') continue
    for (const match of block.text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
      const host = (match[1] ?? '').toLowerCase().replace(/^www\./, '')
      if (host !== '' && !hosts.includes(host)) hosts.push(host)
      if (hosts.length === MAX_SOURCES) return hosts
    }
  }
  return hosts
}

/**
 * The first sentence of a reasoning block, as the step's title.
 * @param text - reasoning text.
 * @returns a short line, or undefined when empty.
 */
export function thoughtOf(text: string): string | undefined {
  const first = text.trim().split(/(?<=[.!?])\s|\n/)[0]?.trim() ?? ''
  if (first === '') return undefined
  return first.length > MAX_THOUGHT ? `${first.slice(0, MAX_THOUGHT - 1)}…` : first
}

type ChainState = ChainData

function replaceTool(steps: readonly ChainStep[], key: string, patch: (step: Extract<ChainStep, { kind: 'tool' }>) => ChainStep): readonly ChainStep[] {
  return steps.map(step => step.kind === 'tool' && step.key === key ? patch(step) : step)
}

/** Turn-scoped Definition published as a `crew-chain` Chat node at the Turn's start. */
export const chainDefinition: ConversationNodeDefinition<ChainState> = {
  kind: 'crew-chain',
  target: 'chat',
  match: (event) => {
    switch (event.type) {
      case 'turn/start': return { id: String(event.data.turn), role: 'start' }
      case 'turn/end':
      case 'tool/call':
      case 'assistant/message':
        return { id: String(event.data.turn), role: 'update' }
      case 'tool/result':
        return isAppendSurfaceEvent(event) ? { id: String(event.data.turn), role: 'update' } : null
      default: return null
    }
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('crew-chain start requires turn/start')
    return { turn: match.event.data.turn, startedAt: match.event.time, steps: [] }
  },
  update: (context, { event }) => {
    const state = context.state
    if (event.type === 'turn/end') return { ...state, endedAt: event.time }
    if (event.type === 'assistant/message') {
      const thoughts = event.data.message.content.flatMap((block, index): ChainStep[] => {
        if (block.type !== 'reasoning') return []
        const text = thoughtOf(block.text)
        return text === undefined ? [] : [{ kind: 'thought', key: `${String(event.seq)}:${String(index)}`, text }]
      })
      return thoughts.length === 0 ? state : { ...state, steps: [...state.steps, ...thoughts] }
    }
    if (event.type === 'tool/call') {
      const detail = detailOf(event.data.arguments)
      const step: ChainStep = {
        kind: 'tool', key: String(event.data.callId), name: event.data.name, startedAt: event.time, sources: [],
        ...detail === undefined ? {} : { detail },
      }
      return { ...state, steps: [...state.steps, step] }
    }
    if (event.type === 'tool/result') {
      const { message } = event.data
      return {
        ...state,
        steps: replaceTool(state.steps, String(message.source.callId), step => ({
          ...step, endedAt: event.time, sources: sourcesOf(message.content), ...message.isError === true ? { failed: true } : {},
        })),
      }
    }
    return state
  },
  buildViewNode: (context): ChatConversationViewNode | null => {
    // A Turn with no reasoning and no tool call is a plain answer; it needs no chain.
    if (context.start === undefined || context.state === undefined || context.state.steps.length === 0) return null
    return {
      key: context.key, kind: 'crew-chain', id: context.id, target: 'chat',
      anchorSeq: context.start.event.seq, location: context.start.location, visibility: 'visible', data: context.state,
    }
  },
}
