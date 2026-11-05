/** The Today page: crew status, digest, what waits for the user, a stock card, this week's calendar and open PRs. */
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewMemberState } from '@deepseek-ai/dsh-crew-agents-ui/client'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { StockChartCards } from '@deepseek-ai/dsh-crew-stock-chart-ui/client'
import type { StockSeries } from '@deepseek-ai/dsh-crew-stock-chart/types'
import type { TodayEvent, TodayPullRequest, TodayResult } from '@deepseek-ai/dsh-crew-today/types'
import type {} from './index.ts'
import css from './TodayPage.module.css'

/** What the page reads and does. */
export interface TodayPageInjected {
  hooks: { members: HostObservable<readonly CrewMemberState[]> }
  readonly Face: ComponentType<CrewFaceProps>
  readonly memberName: (member: CrewMemberState) => string
  readonly design: (member: CrewMemberState) => NonNullable<CrewFaceProps['design']>
  readonly statusLabel: (member: CrewMemberState) => string
  /** Open the member's chat, preferring the Session that waits for the user. */
  readonly openChat: (member: CrewMemberState) => void
  readonly stock: StockChartCards
  /** Ticker shown on the market card. */
  readonly symbol: string
  readonly calendar: () => Promise<TodayResult<TodayEvent> | undefined>
  readonly pullRequests: () => Promise<TodayResult<TodayPullRequest> | undefined>
}

type Props = InjectFace<TodayPageInjected> & PropsLocale<'crewToday'>
type T = Props['t']

function time(value: number | string, withDate = true): string {
  return new Intl.DateTimeFormat(undefined, withDate
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return <section className={css.section} aria-label={title}><h2 className={css.heading}>{title}</h2>{children}</section>
}

/** Load once, with Retry; `undefined` from the loader means dsh could not be reached. */
function useLoad<R>(load: () => Promise<R | undefined>) {
  const [state, setState] = useState<{ readonly value?: R; readonly lost?: true } | undefined>()
  const run = useCallback(() => {
    setState(undefined)
    void load().then((value) => { setState(value === undefined ? { lost: true } : { value }) })
  }, [load])
  useEffect(run, [run])
  return [state, run] as const
}

function Listed<I>({ load, connect, empty, render, t }: {
  readonly load: () => Promise<TodayResult<I> | undefined>
  readonly connect: string
  readonly empty: string
  readonly render: (items: readonly I[]) => ReactNode
  readonly t: T
}) {
  const [state, retry] = useLoad(load)
  if (state === undefined) return <p className={css.muted}>{t('loading')}</p>
  const result = state.value
  if (result === undefined || (!result.ok && result.reason === 'failed')) {
    return (
      <p className={css.notice} role="alert">
        {t('failed', { message: result?.ok === false ? result.message : '' })}{' '}
        <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
      </p>
    )
  }
  if (!result.ok) return <p className={css.muted}>{connect}</p>
  return (
    <>
      {result.items.length === 0 ? <p className={css.muted}>{empty}</p> : render(result.items)}
      <p className={css.source}>
        {t('source', { source: result.source.name, time: time(result.source.fetchedAt) })}{' '}
        <a href={result.source.url} target="_blank" rel="noreferrer">{result.source.url.replace(/^https:\/\//, '')}</a>
      </p>
    </>
  )
}

function Market({ stock, symbol, t }: { readonly stock: StockChartCards; readonly symbol: string; readonly t: T }) {
  const load = useCallback(async (): Promise<StockSeries | undefined> => {
    const result = await stock.quote(symbol, '1d')
    return result?.ok === true ? result.series : undefined
  }, [stock, symbol])
  const [state, retry] = useLoad(load)
  if (state === undefined) return <p className={css.muted}>{t('stock.loading', { symbol })}</p>
  if (state.value === undefined) {
    return <p className={css.notice} role="alert">{t('stock.failed', { symbol })} <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button></p>
  }
  const { Card } = stock
  return <Card initial={state.value} quote={stock.quote} t={stock.t} />
}

function dayOf(event: TodayEvent): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    .format(new Date(event.allDay ? `${event.start}T00:00` : event.start))
}

/** Whether event `index` starts a new day heading. */
function newDay(events: readonly TodayEvent[], index: number): boolean {
  const previous = events[index - 1]
  return previous === undefined || dayOf(previous) !== dayOf(events[index] ?? previous)
}

/**
 * Render the Today page.
 * @param props - crew roster, account loaders, stock card and copy.
 * @returns the page.
 */
export function TodayPage(props: Props) {
  const { useMembers, Face, design, memberName, statusLabel, openChat, stock, symbol, calendar, pullRequests, t } = props
  const members = useMembers(snapshot => snapshot)
  const waiting = members.filter(member => member.status === 'needs-you')
  return (
    <main className={css.page}>
      <div className={css.column}>
        <h1 className={css.title}>{t('title')}</h1>

        <Section title={t('crew.title')}>
          <ul className={css.chips}>
            {members.map(member => (
              <li key={member.id}>
                <button type="button" className={css.chip} data-status={member.status} onClick={() => { openChat(member) }}
                  aria-label={t('crew.open', { name: memberName(member), status: statusLabel(member) })}>
                  <Face agentId={member.id} design={design(member)} mood={member.status === 'working' ? 'working' : 'idle'} size={20} />
                  <span>{memberName(member)}</span>
                  <span className={css.status}>{statusLabel(member)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t('digest.title')}><p className={css.muted}>{t('digest.empty')}</p></Section>

        <Section title={t('approvals.title')}>
          {waiting.length === 0
            ? <p className={css.muted}>{t('approvals.empty')}</p>
            : (
              <ul className={css.list}>
                {waiting.map(member => (
                  <li key={member.id} className={css.card}>
                    <Face agentId={member.id} design={design(member)} size={24} />
                    <span className={css.grow}>{t('approvals.item', { name: memberName(member) })}</span>
                    <Button size="sm" variant="primary" onClick={() => { openChat(member) }}
                      aria-label={t('approvals.openLabel', { name: memberName(member) })}>{t('approvals.open')}</Button>
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section title={t('stock.title')}><Market stock={stock} symbol={symbol} t={t} /></Section>

        <Section title={t('calendar.title')}>
          <Listed load={calendar} connect={t('calendar.connect')} empty={t('calendar.empty')} t={t} render={events => (
            <ul className={css.list}>
              {events.map((event, index) => (
                <li key={event.id} className={css.row}>
                  {newDay(events, index) && <span className={css.day}>{dayOf(event)}</span>}
                  <span className={css.when}>{event.allDay ? t('calendar.allDay') : time(event.start, false)}</span>
                  {event.url === undefined ? <span>{event.title}</span> : <a href={event.url} target="_blank" rel="noreferrer">{event.title}</a>}
                </li>
              ))}
            </ul>
          )} />
        </Section>

        <Section title={t('prs.title')}>
          <Listed load={pullRequests} connect={t('prs.connect')} empty={t('prs.empty')} t={t} render={prs => (
            <ul className={css.list}>
              {prs.map(pr => (
                <li key={pr.url} className={css.row}>
                  <a href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a>
                  <span className={css.muted}>{pr.repository}#{pr.number}</span>
                  {pr.draft && <span className={css.status}>{t('prs.draft')}</span>}
                  <span className={css.muted}>{t('prs.updated', { time: time(pr.updatedAt) })}</span>
                </li>
              ))}
            </ul>
          )} />
        </Section>
      </div>
    </main>
  )
}
