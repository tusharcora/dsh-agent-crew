/** Tool-group row for a `ui_stock_chart` call: symbol and range, expandable to the same card. */
import { useState } from 'react'
import { DisclosureRow, IconDataOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { StockCard, type QuoteFn } from './StockCard.tsx'
import { asSeries, RANGES } from './series.ts'
import css from './StockCard.module.css'

/** What the row receives from its registration. */
export interface StockRowInjected {
  readonly quote: QuoteFn
}

type StockRowProps = ToolCallViewProps & InjectFace<StockRowInjected> & PropsLocale<'stockChart'>

type RowState = 'running' | 'ok' | 'error' | 'stopped'

function stateOf(props: StockRowProps): RowState {
  if (props.phase !== 'result') return 'running'
  if (props.block.error?.code === 'interrupted') return 'stopped'
  return props.block.isError ? 'error' : 'ok'
}

/**
 * Render the call from its arguments and recorded result. A settled call expands to the card; a failed one to the
 * reason the model received.
 * @param props - tool call, quote function and copy.
 * @returns the row.
 */
export function StockRow(props: StockRowProps) {
  const { block, inspect, quote, t } = props
  const [open, setOpen] = useState(false)
  const state = stateOf(props)
  const symbol = block.args.text('symbol') ?? ''
  const requested = block.args.text('range') ?? '1d'
  const range = RANGES.find(entry => entry === requested)
  const series = props.phase === 'result' && !props.block.isError ? asSeries(props.block.meta) : undefined
  const reason = props.phase === 'result' && props.block.isError
    ? props.block.content.flatMap(item => item.type === 'text' ? [item.text] : []).join('\n')
    : ''
  const expandable = series !== undefined || reason !== ''
  const status = state === 'ok' ? '' : t(`row.${state}`)
  return (
    <div data-tool="ui_stock_chart" data-state={state}>
      <DisclosureRow title={t('row.title')} icon={<IconDataOutlineRegular size={14} />} running={state === 'running'}
        open={open && expandable} expandable={expandable} expandOnRowClick keepContentWhenOpen
        onToggle={() => { setOpen(value => !value) }}
        collapsedContent={<span className={css.rowSummary}>{[status, symbol.toUpperCase(), range === undefined ? '' : t(`range.${range}`)].filter(Boolean).join(' · ')}</span>}>
        {series !== undefined ? <StockCard initial={series} quote={quote} t={t} /> : <pre className={css.reason}>{reason}</pre>}
        {inspect && <button type="button" className={css.inspect} onClick={inspect}>{t('row.inspect')}</button>}
      </DisclosureRow>
    </div>
  )
}
