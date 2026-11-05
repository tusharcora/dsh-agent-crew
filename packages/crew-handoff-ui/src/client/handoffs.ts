/** Read handoffs from a Session's loaded events: each subagent start the Session made, with the task it gave. */
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'

/** One task handed from the Session to a subagent. */
export interface Handoff {
  readonly callId: string
  /** Child name the activation returned; matches the parent catalog entry's `name`. */
  readonly child: string
  /** Short task label the model gave, such as "Draft the reply". */
  readonly task: string
  /** First line of the prompt the child received. */
  readonly brief?: string
  /** Preset the call asked for, when it named one. */
  readonly preset?: string
  /** Delegation tool, such as `ask_research`. */
  readonly tool: string
  readonly time: number
}

const MAX_BRIEF = 160

function record(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Every successful subagent start in the window, oldest first. A start is a tool result whose presentation metadata is
 * `{ kind: 'activation', name }`, which every subagent delegation tool returns.
 * @param entries - the Session's loaded event window.
 * @returns the handoffs.
 */
export function handoffsOf(entries: readonly SessionEventLikeEntry[]): readonly Handoff[] {
  const calls = new Map<string, { readonly tool: string; readonly args: Record<string, unknown> | undefined }>()
  const handoffs: Handoff[] = []
  for (const entry of entries) {
    if (entry.type !== 'event') continue
    const { event } = entry
    if (event.type === 'tool/call') {
      calls.set(String(event.data.callId), { tool: event.data.name, args: record(event.data.arguments) })
      continue
    }
    if (event.type !== 'tool/result' || event.data.message.isError === true) continue
    const meta = event.data.meta
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) continue
    const child = text(meta['name'])
    if (meta['kind'] !== 'activation' || child === undefined) continue
    const callId = String(event.data.message.source.callId)
    const call = calls.get(callId)
    const args = call?.args
    const prompt = text(args?.['prompt'])
    const line = prompt?.split('\n')[0]
    const brief = line === undefined ? undefined : line.length > MAX_BRIEF ? `${line.slice(0, MAX_BRIEF - 1)}…` : line
    const preset = text(args?.['agent_preset'])
    handoffs.push({
      callId, child, task: text(args?.['description']) ?? child, tool: call?.tool ?? 'subagent', time: event.time,
      ...brief === undefined ? {} : { brief }, ...preset === undefined ? {} : { preset },
    })
  }
  return handoffs
}
