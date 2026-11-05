/** Agent cards across the top and, below them, one lane of handoffs per agent that received work. */
import type { ComponentType } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AgentCard, HandoffViewData } from './view.ts'
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

function time(value: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function Face({ card, props, size }: { readonly card: AgentCard; readonly props: HandoffViewProps; readonly size: number }) {
  const design = props.designOf(card)
  const { Face: Drawn } = props
  return <Drawn agentId={card.preset ?? card.name} size={size} mood={card.state === 'working' ? 'working' : 'idle'} {...design === undefined ? {} : { design }} />
}

function Card({ card, props, lead }: { readonly card: AgentCard; readonly props: HandoffViewProps; readonly lead?: true }) {
  const { t } = props
  const name = props.nameOf(card)
  const state = t(`state.${card.state}`)
  return (
    <li>
      <button type="button" className={css.card} data-state={card.state} onClick={() => { props.open(card.sessionId) }}
        aria-label={t('card.open', { name, state })}>
        <span className={css.cardHead}>
          <Face card={card} props={props} size={24} />
          <span className={css.cardName}>{name}</span>
          <span className={css.state} data-state={card.state}>{state}</span>
        </span>
        {card.preset !== undefined && <span className={css.muted}>{card.preset}</span>}
        {lead !== true && <span className={css.task}>{card.task === undefined ? t('card.ready') : t('card.task', { task: card.task })}</span>}
        {card.handoffs > 0 && <span className={css.muted}>{t('card.count', { count: card.handoffs })}</span>}
      </button>
    </li>
  )
}

/**
 * Render the cards and lanes.
 * @param props - view data, faces, names, navigation and copy.
 * @returns the view.
 */
export function HandoffView(props: HandoffViewProps) {
  const { data, t } = props
  const leadName = props.nameOf(data.lead)
  return (
    <div className={css.root}>
      <ul className={css.cards}>
        <Card card={data.lead} props={props} lead />
        {data.agents.map(card => <Card key={card.sessionId} card={card} props={props} />)}
      </ul>
      {data.lanes.length === 0
        ? <p className={css.muted}>{t('empty')}</p>
        : (
          <div className={css.lanes}>
            {data.lanes.map((lane) => {
              const to = props.nameOf(lane.to)
              return (
                <section key={lane.to.sessionId} className={css.lane} aria-label={t('lane.label', { from: leadName, to })}>
                  <h3 className={css.laneHead}>
                    <Face card={data.lead} props={props} size={16} /><span>{leadName}</span>
                    <span aria-hidden="true">→</span>
                    <Face card={lane.to} props={props} size={16} /><span>{to}</span>
                    <span className={css.count}>{t('lane.count', { count: lane.items.length })}</span>
                  </h3>
                  <ol className={css.items}>
                    {lane.items.map((item, index) => {
                      const current = index === 0 && lane.to.state !== 'idle'
                      return (
                        <li key={item.callId} className={css.item}>
                          <span className={css.itemTask}>{item.task}</span>
                          {item.brief !== undefined && <span className={css.brief}>{item.brief}</span>}
                          <span className={css.itemMeta}>
                            <span className={css.dot} data-state={current ? lane.to.state : 'done'} aria-hidden="true" />
                            {current ? t('item.with', { name: to }) : t('item.back')}
                            <span>· {t('item.time', { time: time(item.time) })} · {t('item.via', { tool: item.tool })}</span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </section>
              )
            })}
          </div>
        )}
    </div>
  )
}
