/** The lead as a hub card, then one row per agent, most urgent first, each opening into a timeline of what it was handed. */
import { useState, type ComponentType } from 'react'
import { IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentCard, AgentState, HandoffViewData } from './view.ts'
import type {} from './index.ts'
import css from './HandoffView.module.css'

/** Props of {@link HandoffView}. */
export interface HandoffViewProps {
  readonly data: HandoffViewData
  readonly Face: ComponentType<CrewFaceProps>
  /** Display name for a card: the crew member's name for a crew preset, else the agent's own name. */
  readonly nameOf: (card: AgentCard) => string
  /** Designed face for a crew preset, when the card runs one. */
  readonly designOf: (card: AgentCard) => CrewFaceProps['design'] | undefined
  readonly open: (sessionId: SessionId) => void
  readonly t: TranslateNS<'crewHandoff'>
}

const URGENCY: Readonly<Record<AgentState, number>> = { 'needs-you': 0, working: 1, idle: 2 }

function time(value: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function Face({ card, props, size }: { readonly card: AgentCard; readonly props: HandoffViewProps; readonly size: number }) {
  const design = props.designOf(card)
  const { Face: Drawn } = props
  return <Drawn agentId={card.preset ?? card.name} size={size} mood={card.state === 'working' ? 'working' : 'idle'} {...design === undefined ? {} : { design }} />
}

/**
 * Render the hub, agent rows and their timelines.
 * @param props - view data, faces, names, navigation and copy.
 * @returns the view.
 */
export function HandoffView(props: HandoffViewProps) {
  const { data, t } = props
  // Rows the user opened or closed; the rest open while their agent is busy.
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({})
  const leadName = props.nameOf(data.lead)
  const lanes = new Map(data.lanes.map(lane => [lane.to.sessionId, lane.items]))
  const agents = [...data.agents].sort((a, b) => URGENCY[a.state] - URGENCY[b.state])
  const needsYou = agents.filter(card => card.state === 'needs-you').length
  const working = agents.filter(card => card.state === 'working').length
  const leadState = t(`state.${data.lead.state}`)
  return (
    <div className={css.root}>
      <header className={css.head}>
        <div className={css.headText}>
          <h2 className={css.title}>{t('tab.title')}</h2>
          <p className={css.summary}>{t('summary', { agents: agents.length, handoffs: data.lead.handoffs })}</p>
        </div>
        {needsYou > 0 ? <span className={css.pill} data-state="needs-you">{t('summary.needsYou', { count: needsYou })}</span>
          : working > 0 && <span className={css.pill} data-state="working">{t('summary.working', { count: working })}</span>}
      </header>

      <button type="button" className={css.hub} data-state={data.lead.state} onClick={() => { props.open(data.lead.sessionId) }}
        aria-label={t('card.open', { name: leadName, state: leadState })}>
        <Face card={data.lead} props={props} size={36} />
        <span className={css.who}>
          <span className={css.name}>{leadName}</span>
          <span className={css.muted}>{data.lead.preset ?? t('lead.role')}</span>
        </span>
        <span className={css.stat}><b>{data.lead.handoffs}</b><span>{t('lead.count')}</span></span>
      </button>

      {agents.length === 0 && <p className={css.muted}>{t('empty')}</p>}
      <ul className={css.agents}>
        {agents.map((card) => {
          const name = props.nameOf(card)
          const state = t(`state.${card.state}`)
          const items = lanes.get(card.sessionId) ?? []
          const isOpen = items.length > 0 && (expanded[card.sessionId] ?? card.state !== 'idle')
          return (
            <li key={card.sessionId} className={css.agent} data-state={card.state}>
              <div className={css.row}>
                <button type="button" className={css.main} onClick={() => { props.open(card.sessionId) }} aria-label={t('card.open', { name, state })}>
                  <Face card={card} props={props} size={32} />
                  <span className={css.who}>
                    <span className={css.nameLine}>
                      <span className={css.name}>{name}</span>
                      {card.preset !== undefined && <span className={css.preset}>{card.preset}</span>}
                    </span>
                    <span className={css.now}>
                      {card.task === undefined ? t('card.ready') : t('card.task', { task: card.task })}
                      {card.handoffs > 0 && <span className={css.muted}> · {t('card.count', { count: card.handoffs })}</span>}
                    </span>
                  </span>
                  <span className={css.pill} data-state={card.state}>{state}</span>
                </button>
                {items.length > 0 && (
                  <button type="button" className={css.toggle} aria-expanded={isOpen} aria-label={t('lane.toggle', { name })}
                    onClick={() => { setExpanded(prev => ({ ...prev, [card.sessionId]: !isOpen })) }}>
                    <IconChevronRightOutlineRegular size={14} />
                  </button>
                )}
              </div>
              {isOpen && (
                <section className={css.lane} aria-label={t('lane.label', { from: leadName, to: name })}>
                  <ol className={css.items}>
                    {items.map((item, index) => {
                      const current = index === 0 && card.state !== 'idle'
                      return (
                        <li key={item.callId} className={css.item}>
                          <span className={css.mark} data-state={current ? card.state : 'done'} aria-hidden="true" />
                          <span className={css.itemTask}>{item.task}</span>
                          {item.brief !== undefined && <span className={css.brief}>{item.brief}</span>}
                          <span className={css.itemMeta}>
                            <span className={css.itemState}>{current ? t('item.with', { name }) : t('item.back')}</span>
                            <span className={css.time}>{t('item.time', { time: time(item.time) })}</span>
                            <span>{t('item.via', { tool: item.tool })}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
