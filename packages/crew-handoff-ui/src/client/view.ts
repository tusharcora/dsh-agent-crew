/** Turn handoffs, the parent catalog and live Session state into agent cards and handoff lanes. */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentCatalogEntry } from '@deepseek-ai/dsh-subagent/client'
import type { Handoff } from './handoffs.ts'

/** Live state shown on a card; `needs-you` wins over `working`. */
export type AgentState = 'working' | 'needs-you' | 'idle'

/** One agent card. */
export interface AgentCard {
  /** Child Session, or the lead Session itself. */
  readonly sessionId: SessionId
  /** Catalog name, or `lead` for the Session itself. */
  readonly name: string
  /** Preset the Session runs, when the Session list reports one. */
  readonly preset?: string
  readonly state: AgentState
  /** Task of the newest handoff to this agent. */
  readonly task?: string
  /** Handoffs this agent received; for the lead, handoffs it made. */
  readonly handoffs: number
}

/** All handoffs from the lead to one agent, newest first. */
export interface HandoffLane {
  readonly to: AgentCard
  readonly items: readonly Handoff[]
}

/** What the view draws. */
export interface HandoffViewData {
  readonly lead: AgentCard
  readonly agents: readonly AgentCard[]
  readonly lanes: readonly HandoffLane[]
}

function stateOf(id: SessionId, list: SessionListState, status: SessionStatusSnapshot): AgentState {
  const live = status.get(id)
  if (live?.pendingInteraction !== undefined) return 'needs-you'
  return (live?.running ?? list.byId[id]?.running) === true ? 'working' : 'idle'
}

function presetOf(id: SessionId, list: SessionListState): string | undefined {
  const preset = list.byId[id]?.projectionValues?.agentPreset
  return typeof preset === 'string' ? preset : undefined
}

/**
 * Build the view for one lead Session.
 * @param lead - the Session whose handoffs these are.
 * @param handoffs - its handoffs, oldest first.
 * @param catalog - its direct children, in creation order.
 * @param list - the Session list, for presets and running state.
 * @param status - live Session status, for running and waiting.
 * @returns cards in creation order and lanes for agents that received work.
 */
export function buildHandoffView(
  lead: SessionId,
  handoffs: readonly Handoff[],
  catalog: readonly SubagentCatalogEntry[],
  list: SessionListState,
  status: SessionStatusSnapshot,
): HandoffViewData {
  const leadPreset = presetOf(lead, list)
  const leadCard: AgentCard = { sessionId: lead, name: 'lead', state: stateOf(lead, list, status), handoffs: handoffs.length, ...leadPreset === undefined ? {} : { preset: leadPreset } }
  const agents = catalog.map((entry): AgentCard => {
    const name = ('name' in entry ? entry.name : undefined) ?? entry.label ?? entry.id
    const mine = handoffs.filter(handoff => handoff.child === name)
    const latest = mine.at(-1)
    const preset = presetOf(entry.id, list) ?? mine.findLast(handoff => handoff.preset !== undefined)?.preset
    return {
      sessionId: entry.id, name, state: stateOf(entry.id, list, status), handoffs: mine.length,
      ...preset === undefined ? {} : { preset }, ...latest === undefined ? {} : { task: latest.task },
    }
  })
  const lanes = agents.flatMap((card): HandoffLane[] => {
    const items = handoffs.filter(handoff => handoff.child === card.name).reverse()
    return items.length === 0 ? [] : [{ to: card, items }]
  })
  return { lead: leadCard, agents, lanes }
}
