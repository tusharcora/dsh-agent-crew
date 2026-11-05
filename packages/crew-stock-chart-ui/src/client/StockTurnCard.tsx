/** Stock cards beneath a Turn's closing answer. */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { StockCard, type QuoteFn } from './StockCard.tsx'
import { chartsForTurn } from './stock-turn.ts'
import css from './StockCard.module.css'

/** What the tail entry receives from its registration. */
export interface StockTurnInjected {
  readonly quote: QuoteFn
}

/** Props of {@link StockTurnCard}. */
export type StockTurnCardProps = PropsRuntime<'conversation.chat.turnTail'> & InjectFace<StockTurnInjected> & PropsLocale<'stockChart'>

/**
 * Render one card per chart the Turn recorded; the tail list renders for every Turn, so this narrows to its own.
 * @param props - closing Turn, quote function and copy.
 * @returns the cards, or null when the Turn drew no chart.
 */
export function StockTurnCard(props: StockTurnCardProps) {
  const charts = chartsForTurn(props)
  if (charts.length === 0) return null
  return (
    <div className={css.tail}>
      {charts.map(chart => <StockCard key={chart.callId} initial={chart.series} quote={props.quote} t={props.t} />)}
    </div>
  )
}
