/** Tool access map: agent chips, the selected agent between its tools, and a read-only inspector for one tool's calls. */
import { useState, type ComponentType } from 'react'
import {
  IconCheckOutlineRegular, IconChevronLeftOutlineRegular, IconLoadingOutlineRegular, IconWarningOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { ToolCallRecord, ToolNode } from './tools.ts'
import type {} from './index.ts'
import css from './ToolMapView.module.css'

/** One selectable agent. */
export interface MapAgent {
  readonly key: string
  readonly name: string
  /** Face id and optional design, as the crew roster draws it. */
  readonly faceId: string
  readonly design?: CrewFaceProps['design']
}

/** Props of {@link ToolMapView}. */
export interface ToolMapViewProps {
  readonly agents: readonly MapAgent[]
  readonly selected: string
  readonly onSelect: (key: string) => void
  /** Tools of the selected agent, or undefined while its Session loads. */
  readonly nodes: readonly ToolNode[] | undefined
  readonly failed?: boolean
  readonly Face: ComponentType<CrewFaceProps>
  readonly t: TranslateNS<'crewToolMap'>
}

const SECONDS = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'second', unitDisplay: 'narrow', maximumFractionDigits: 1 })

function seconds(ms: number): string {
  return SECONDS.format(Math.max(0, ms) / 1000)
}

function clock(value: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

function stateOf(node: ToolNode, t: ToolMapViewProps['t']): string {
  if (node.running > 0) return t('access.running')
  if (node.access === 'used') {
    const time = node.lastMs === undefined ? '—' : seconds(node.lastMs)
    return t('access.used', { count: node.calls.length, time })
  }
  return t(node.access === 'available' ? 'access.available' : 'access.none')
}

function pretty(input: string): string {
  try { return JSON.stringify(JSON.parse(input), null, 2) } catch { return input }
}

function CallState({ call }: { readonly call: ToolCallRecord }) {
  if (call.endedAt === undefined) return <IconLoadingOutlineRegular size={14} className={css.spin} />
  if (call.failed === true) return <IconWarningOutlineRegular size={14} className={css.bad} />
  return <IconCheckOutlineRegular size={14} className={css.good} />
}

function Detail({ node, onBack, t }: { readonly node: ToolNode; readonly onBack: () => void; readonly t: ToolMapViewProps['t'] }) {
  const [chosen, setChosen] = useState<string | undefined>(node.calls.at(-1)?.callId)
  const call = node.calls.find(entry => entry.callId === chosen)
  const label = (entry: ToolCallRecord) => entry.endedAt === undefined ? t('call.running') : entry.failed === true ? t('call.failed') : t('call.ok')
  return (
    <section className={css.detail} aria-label={node.tool}>
      <div className={css.detailHead}>
        <button type="button" className={css.back} onClick={onBack} aria-label={t('detail.back')}><IconChevronLeftOutlineRegular size={14} /></button>
        <span className={css.detailTitle}>{node.tool}</span>
        <span className={css.muted}>{t('detail.calls', { count: node.calls.length })}</span>
      </div>
      {node.calls.length === 0
        ? <p className={css.muted}>{t('detail.none', { tool: node.tool })}</p>
        : (
          <div className={css.detailBody}>
            <ul className={css.calls}>
              {[...node.calls].reverse().map(entry => (
                <li key={entry.callId}>
                  <button type="button" className={css.call} aria-pressed={entry.callId === chosen}
                    aria-label={t('call.open', { time: clock(entry.startedAt), state: label(entry) })} onClick={() => { setChosen(entry.callId) }}>
                    <CallState call={entry} />
                    <code className={css.callInput}>{entry.input}</code>
                    <span className={css.muted}>{entry.endedAt === undefined ? '' : seconds(entry.endedAt - entry.startedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {call !== undefined && (
              <div className={css.io}>
                <h4 className={css.ioHead}>{t('detail.input')} <span className={css.muted}>{clock(call.startedAt)}</span></h4>
                <pre className={css.pre}>{pretty(call.input)}</pre>
                <h4 className={css.ioHead}>{t('detail.output')}</h4>
                <pre className={css.pre}>{call.endedAt === undefined ? t('detail.waiting') : call.output ?? t('detail.noOutput')}</pre>
              </div>
            )}
          </div>
        )}
    </section>
  )
}

/**
 * Render the map for the selected agent.
 * @param props - agents, selection, tools, face component and copy.
 * @returns the map or the inspector for one tool.
 */
export function ToolMapView({ agents, selected, onSelect, nodes, failed, Face, t }: ToolMapViewProps) {
  const [openTool, setOpenTool] = useState<string | undefined>()
  const agent = agents.find(entry => entry.key === selected) ?? agents[0]
  const used = nodes?.filter(node => node.access !== 'none').length ?? 0
  const calls = nodes?.reduce((sum, node) => sum + node.calls.length, 0) ?? 0
  const running = nodes?.reduce((sum, node) => sum + node.running, 0) ?? 0
  const open = nodes?.find(node => node.tool === openTool)
  const half = Math.ceil((nodes?.length ?? 0) / 2)
  const Tool = ({ node }: { readonly node: ToolNode }) => (
    <li className={css.toolItem} data-access={node.access}>
      <button type="button" className={css.tool} data-access={node.access} data-running={node.running > 0 || undefined}
        aria-label={t('tool.open', { tool: node.tool, state: stateOf(node, t) })} onClick={() => { setOpenTool(node.tool) }}>
        <span className={css.toolName}>{node.tool}</span>
        <span className={css.muted}>{stateOf(node, t)}</span>
      </button>
    </li>
  )
  return (
    <div className={css.root}>
      <div className={css.header}>
        <h3 className={css.title}>{t('title')}</h3>
        {running > 0 && <span className={css.running}>{t('running.count', { count: running })}</span>}
        {nodes !== undefined && <span className={css.muted}>{t('summary', { used, total: nodes.length, calls })}</span>}
      </div>
      <div className={css.chips} role="group" aria-label={t('agents')}>
        {agents.map(entry => (
          <button key={entry.key} type="button" className={css.chip} aria-pressed={entry.key === agent?.key}
            onClick={() => { setOpenTool(undefined); onSelect(entry.key) }}>
            <Face agentId={entry.faceId} size={16} {...entry.design === undefined ? {} : { design: entry.design }} />
            {entry.name}
          </button>
        ))}
      </div>
      {failed === true && agent !== undefined && <p className={css.bad} role="alert">{t('loadFailed', { name: agent.name })}</p>}
      {nodes === undefined && failed !== true && agent !== undefined && <p className={css.muted}>{t('loading', { name: agent.name })}</p>}
      {nodes !== undefined && open !== undefined && <Detail key={open.tool} node={open} onBack={() => { setOpenTool(undefined) }} t={t} />}
      {nodes !== undefined && open === undefined && agent !== undefined && (
        nodes.length === 0
          ? <p className={css.muted}>{t('empty')}</p>
          : (
            <div className={css.map}>
              <ul className={css.side} data-side="left">{nodes.slice(0, half).map(node => <Tool key={node.tool} node={node} />)}</ul>
              <div className={css.agent}>
                <Face agentId={agent.faceId} size={32} {...agent.design === undefined ? {} : { design: agent.design }} />
                <span className={css.agentName}>{agent.name}</span>
                <span className={css.muted}>{t('agent.calls', { count: calls })}</span>
              </div>
              <ul className={css.side} data-side="right">{nodes.slice(half).map(node => <Tool key={node.tool} node={node} />)}</ul>
            </div>
          )
      )}
    </div>
  )
}
