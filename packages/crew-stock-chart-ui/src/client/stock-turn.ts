/**
 * Turn-scoped stock charts: the series each settled `ui_stock_chart` call recorded, published against its Turn so the
 * card renders beneath the closing answer through `conversation.chat.turnTail`. The series is read from the persisted
 * result metadata, so replaying the Session log reproduces the card.
 */
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
import type { ConversationNodeDefinition, TurnLocation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { StockSeries } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'
import { asSeries } from './series.ts'

/** Wire tool name. */
export const STOCK_CHART_TOOL = 'ui_stock_chart'

/** One recorded chart. */
export interface StockTurnChart {
  readonly callId: string
  readonly seq: number
  readonly series: StockSeries
}

/** Charts published against one Turn. */
export interface StockTurnData {
  readonly charts: readonly StockTurnChart[]
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    /** `ui_stock_chart` results settled in this Turn, in settlement order. */
    'stock-charts': StockTurnData
  }
}

interface StockTurnState {
  readonly turn: number
  /** Call ids of this Turn's `ui_stock_chart` calls. */
  readonly calls: ReadonlySet<string>
  readonly charts: readonly StockTurnChart[]
}

/**
 * Charts of one Turn up to its end.
 * @param owner - closing Turn and the owner's sequence, used when the Turn has no recorded end.
 * @param owner.turn - the Turn.
 * @param owner.seq - owner sequence.
 * @returns the charts, or an empty list.
 */
export function chartsForTurn(owner: { readonly turn: TurnLocation; readonly seq: number }): readonly StockTurnChart[] {
  const bound = owner.turn.end?.seq ?? owner.seq
  return (owner.turn.data.get('stock-charts')?.charts ?? []).filter(chart => chart.seq <= bound)
}

/** Turn-local accumulator; it publishes no view Node. */
export const stockTurnDefinition: ConversationNodeDefinition<StockTurnState> = {
  kind: 'stock-charts',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && isAppendSurfaceEvent(event)) return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('stock-charts start requires turn/start')
    return { turn: match.event.data.turn, calls: new Set(), charts: [] }
  },
  update: (context, match) => {
    const { event } = match
    if (event.type === 'tool/call') {
      if (event.data.name !== STOCK_CHART_TOOL) return context.state
      return { ...context.state, calls: new Set([...context.state.calls, String(event.data.callId)]) }
    }
    if (event.type !== 'tool/result' || event.data.message.isError === true) return context.state
    const callId = String(event.data.message.source.callId)
    if (!context.state.calls.has(callId)) return context.state
    const series = asSeries(event.data.meta)
    if (series === undefined) return context.state
    return { ...context.state, charts: [...context.state.charts, { callId, seq: event.seq, series }] }
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== 'turn' || context.state === undefined) return null
    if (previous?.kind === 'turn' && previous.turn === context.state.turn && previous.key === 'stock-charts'
      && previous.value.charts === context.state.charts) return previous
    return { kind: 'turn', turn: context.state.turn, key: 'stock-charts', value: { charts: context.state.charts } }
  },
}
