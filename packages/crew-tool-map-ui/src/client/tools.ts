/** Fold one Session's events into the tools it was offered and every call it made, then into one agent's map. */
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'

/** One recorded tool call. */
export interface ToolCallRecord {
  readonly callId: string
  readonly tool: string
  /** Raw JSON arguments as the model wrote them. */
  readonly input: string
  readonly startedAt: number
  readonly endedAt?: number
  readonly failed?: boolean
  /** Text of the result, cut to a readable length. */
  readonly output?: string
}

/** What one Session's log says about its tools. */
export interface AgentTools {
  /** Tool names its newest request offered the model; undefined before its first request. */
  readonly offered: readonly string[] | undefined
  /** Calls in log order. */
  readonly calls: readonly ToolCallRecord[]
}

/** Access an agent has to one tool. */
export type ToolAccess = 'used' | 'available' | 'none'

/** One tool on an agent's map. */
export interface ToolNode {
  readonly tool: string
  readonly access: ToolAccess
  readonly calls: readonly ToolCallRecord[]
  readonly running: number
  /** Duration of the newest finished call. */
  readonly lastMs?: number
  readonly failed: number
}

const MAX_OUTPUT = 4000

/**
 * Fold a Session's loaded event window.
 * @param entries - the window's entries.
 * @returns offered tools and calls.
 */
export function foldTools(entries: readonly SessionEventLikeEntry[]): AgentTools {
  let offered: readonly string[] | undefined
  const calls = new Map<string, ToolCallRecord>()
  for (const entry of entries) {
    if (entry.type !== 'event') continue
    const { event } = entry
    if (event.type === 'request/header') {
      offered = (event.data.header.tools ?? []).map(schema => schema.name)
    } else if (event.type === 'tool/call') {
      const callId = String(event.data.callId)
      calls.set(callId, { callId, tool: event.data.name, input: event.data.arguments, startedAt: event.time })
    } else if (event.type === 'tool/result') {
      const { message } = event.data
      const callId = String(message.source.callId)
      const call = calls.get(callId)
      if (call === undefined) continue
      const text = message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
      calls.set(callId, {
        ...call, endedAt: event.time, ...message.isError === true ? { failed: true } : {},
        ...text === '' ? {} : { output: text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT - 1)}…` : text },
      })
    }
  }
  return { offered, calls: [...calls.values()] }
}

/**
 * One agent's map: every tool it was offered or called, plus tools other known agents have that it lacks.
 * @param agent - the selected agent's tools.
 * @param others - tools of the other agents loaded in this view.
 * @returns tools in a stable order: used, then available, then without access, each by name.
 */
export function toolMap(agent: AgentTools, others: readonly AgentTools[]): readonly ToolNode[] {
  const names = new Set<string>([...agent.offered ?? [], ...agent.calls.map(call => call.tool)])
  const elsewhere = new Set(others.flatMap(other => [...other.offered ?? [], ...other.calls.map(call => call.tool)]))
  const nodes: ToolNode[] = []
  for (const tool of new Set([...names, ...elsewhere])) {
    const calls = agent.calls.filter(call => call.tool === tool)
    const finished = calls.filter(call => call.endedAt !== undefined)
    const last = finished.at(-1)
    nodes.push({
      tool, calls,
      access: calls.length > 0 ? 'used' : names.has(tool) ? 'available' : 'none',
      running: calls.length - finished.length,
      failed: calls.filter(call => call.failed === true).length,
      ...last?.endedAt === undefined ? {} : { lastMs: last.endedAt - last.startedAt },
    })
  }
  const rank: Record<ToolAccess, number> = { used: 0, available: 1, none: 2 }
  return nodes.sort((a, b) => rank[a.access] - rank[b.access] || a.tool.localeCompare(b.tool))
}
