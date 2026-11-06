/**
 * The Today page: a greeting, four at-a-glance tiles, what waits for the user, today's hours with a now line and the
 * rest of the week, open PRs, and a side column with the crew, a stock card and the digest.
 */
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { Button, IconCheckCircleOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
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
/** A loader's state: undefined while loading; `lost` when dsh could not be reached. */
type Loaded<R> = { readonly value?: R; readonly lost?: true } | undefined

const MINUTE = 60_000
const HOUR_PX = 48

function time(value: number | string, withDate = true): string {
  return new Intl.DateTimeFormat(undefined, withDate
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

/** "in 25 minutes", "3 hours ago": the largest whole unit. */
function relative(target: number, now: number): string {
  const minutes = Math.round((target - now) / MINUTE)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), 'hour')
  return format.format(Math.round(minutes / (60 * 24)), 'day')
}

/** The current time, re-read every `ms`. */
function useNow(ms: number): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, ms)
    return () => { clearInterval(timer) }
  }, [ms])
  return now
}

/** Load once, with Retry; `undefined` from the loader means dsh could not be reached. */
function useLoad<R>(load: () => Promise<R | undefined>) {
  const [state, setState] = useState<Loaded<R>>()
  const run = useCallback(() => {
    setState(undefined)
    void load().then((value) => { setState(value === undefined ? { lost: true } : { value }) })
  }, [load])
  useEffect(run, [run])
  return [state, run] as const
}

/** Items of a loaded list, or undefined while loading, failed or not connected. */
function itemsOf<I>(state: Loaded<TodayResult<I>>): readonly I[] | undefined {
  const result = state?.value
  return result?.ok === true ? result.items : undefined
}

function Section({ title, action, children }: { readonly title: string; readonly action?: ReactNode; readonly children: ReactNode }) {
  return (
    <section className={css.section} aria-label={title}>
      <header className={css.sectionHead}><h2 className={css.heading}>{title}</h2>{action}</header>
      {children}
    </section>
  )
}

function Skeleton({ t }: { readonly t: T }) {
  return (
    <div className={css.skeleton} aria-busy="true">
      <span className={css.srOnly}>{t('loading')}</span>
      <i /><i /><i />
    </div>
  )
}

function Refresh({ title, onClick, busy, t }: {
  readonly title: string
  readonly onClick: () => void
  readonly busy: boolean
  readonly t: T
}) {
  return (
    <button type="button" className={css.refresh} data-busy={busy || undefined} onClick={onClick} disabled={busy}
      aria-label={t('refresh', { section: title })}>
      <IconRefreshOutlineRegular size={14} />
    </button>
  )
}

function Listed<I>({ title, state, retry, connect, empty, render, t }: {
  readonly title: string
  readonly state: Loaded<TodayResult<I>>
  readonly retry: () => void
  readonly connect: string
  readonly empty: string
  readonly render: (items: readonly I[]) => ReactNode
  readonly t: T
}) {
  const body = (): ReactNode => {
    if (state === undefined) return <Skeleton t={t} />
    const result = state.value
    if (result === undefined || (!result.ok && result.reason === 'failed')) {
      return (
        <div className={css.notice} role="alert">
          <span>{t('failed', { message: result?.ok === false ? result.message : '' })}</span>
          <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
        </div>
      )
    }
    if (!result.ok) return <p className={css.connect}>{connect}</p>
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
  return <Section title={title} action={<Refresh title={title} onClick={retry} busy={state === undefined} t={t} />}>{body()}</Section>
}

function Market({ stock, symbol, t }: { readonly stock: StockChartCards; readonly symbol: string; readonly t: T }) {
  const load = useCallback(async (): Promise<StockSeries | undefined> => {
    const result = await stock.quote(symbol, '1d')
    return result?.ok === true ? result.series : undefined
  }, [stock, symbol])
  const [state, retry] = useLoad(load)
  if (state === undefined) return <Skeleton t={t} />
  if (state.value === undefined) {
    return (
      <div className={css.notice} role="alert">
        <span>{t('stock.failed', { symbol })}</span>
        <Button size="sm" variant="outline" onClick={retry}>{t('retry')}</Button>
      </div>
    )
  }
  const { Card } = stock
  return <Card initial={state.value} quote={stock.quote} t={stock.t} />
}

function startOf(event: TodayEvent): number {
  return new Date(event.allDay ? `${event.start}T00:00` : event.start).getTime()
}

function endOf(event: TodayEvent): number {
  return event.allDay ? startOf(event) + 24 * 60 * MINUTE : new Date(event.end).getTime()
}

function dayKey(value: number): string {
  return new Date(value).toDateString()
}

function dayOf(event: TodayEvent): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(startOf(event)))
}

/** The next timed event that has not started. */
function nextEvent(events: readonly TodayEvent[], now: number): TodayEvent | undefined {
  return events.find(event => !event.allDay && startOf(event) > now)
}

/** Today's timed events on an hour grid, with a line at the current time. */
function Hours({ events, now, t }: { readonly events: readonly TodayEvent[]; readonly now: number; readonly t: T }) {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  const hourOf = (value: number) => (value - day.getTime()) / (60 * MINUTE)
  const first = Math.min(8, ...events.map(event => Math.floor(hourOf(startOf(event)))))
  const last = Math.max(18, ...events.map(event => Math.ceil(hourOf(endOf(event)))))
  const from = Math.max(0, first)
  const to = Math.min(24, last)
  const hours = Array.from({ length: to - from }, (_, index) => from + index)
  const next = nextEvent(events, now)
  const nowHour = hourOf(now)
  const label = (hour: number) => new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(day.getTime() + hour * 60 * MINUTE))
  return (
    <div className={css.hours}>
      <div className={css.hourLabels} aria-hidden="true">
        {hours.map(hour => <span key={hour} style={{ height: HOUR_PX }}>{label(hour)}</span>)}
      </div>
      {/* shortcut: overlapping events draw over each other; split into columns when someone has double bookings. */}
      <ul className={css.hourGrid} style={{ height: hours.length * HOUR_PX }}>
        {events.map((event) => {
          const start = startOf(event)
          const end = endOf(event)
          const phase = end <= now ? 'past' : start <= now ? 'now' : event === next ? 'next' : 'later'
          return (
            <li key={event.id} className={css.block} data-phase={phase}
              style={{ top: (hourOf(start) - from) * HOUR_PX, height: Math.max((hourOf(end) - hourOf(start)) * HOUR_PX - 3, 24) }}>
              <span className={css.blockText}>
                <span className={css.blockTitle}>
                  {event.url === undefined ? event.title : <a href={event.url} target="_blank" rel="noreferrer">{event.title}</a>}
                </span>
                <span className={css.blockTime}>{time(event.start, false)} – {time(event.end, false)}</span>
              </span>
              {phase === 'now' && <span className={css.pill} data-tone="live">{t('calendar.now')}</span>}
              {phase === 'next' && <span className={css.pill} data-tone="next">{relative(start, now)}</span>}
            </li>
          )
        })}
        {nowHour >= from && nowHour <= to && (
          <li className={css.nowLine} style={{ top: (nowHour - from) * HOUR_PX }} aria-label={t('calendar.nowAt', { time: time(now, false) })} />
        )}
      </ul>
    </div>
  )
}

function Week({ events, now, t }: { readonly events: readonly TodayEvent[]; readonly now: number; readonly t: T }) {
  const today = dayKey(now)
  const timed = events.filter(event => !event.allDay && dayKey(startOf(event)) === today)
  const allDay = events.filter(event => event.allDay && dayKey(startOf(event)) === today)
  const rest = events.filter(event => dayKey(startOf(event)) !== today)
  return (
    <>
      {allDay.length > 0 && (
        <ul className={css.allDay}>
          {allDay.map(event => <li key={event.id} className={css.pill}>{t('calendar.allDay')} · {event.title}</li>)}
        </ul>
      )}
      {timed.length > 0 && <Hours events={timed} now={now} t={t} />}
      {rest.length > 0 && (
        <>
          <h3 className={css.subheading}>{t('calendar.later')}</h3>
          <ul className={css.list}>
            {rest.map((event, index) => (
              <li key={event.id} className={css.eventItem}>
                {(index === 0 || dayOf(rest[index - 1] ?? event) !== dayOf(event)) && <span className={css.day}>{dayOf(event)}</span>}
                <span className={css.event} data-phase={endOf(event) <= now ? 'past' : 'later'}>
                  <span className={css.when}>{event.allDay ? t('calendar.allDay') : time(event.start, false)}</span>
                  <span className={css.eventTitle}>
                    {event.url === undefined ? event.title : <a href={event.url} target="_blank" rel="noreferrer">{event.title}</a>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function Tile({ label, value, detail, tone }: { readonly label: string; readonly value: string; readonly detail: string; readonly tone?: 'warn' }) {
  return (
    <div className={css.tile} data-tone={tone}>
      <span className={css.tileLabel}>{label}</span>
      <span className={css.tileValue}><b>{value}</b>{detail}</span>
    </div>
  )
}

function greeting(now: number): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  const hour = new Date(now).getHours()
  return hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening'
}

/**
 * Render the Today page.
 * @param props - crew roster, account loaders, stock card and copy.
 * @returns the page.
 */
export function TodayPage(props: Props) {
  const { useMembers, Face, design, memberName, statusLabel, openChat, stock, symbol, calendar, pullRequests, t } = props
  const members = useMembers(snapshot => snapshot)
  const now = useNow(MINUTE)
  const [events, retryEvents] = useLoad(calendar)
  const [prs, retryPrs] = useLoad(pullRequests)
  const waiting = members.filter(member => member.status === 'needs-you')
  const working = members.filter(member => member.status === 'working').length
  const eventItems = itemsOf(events)
  const prItems = itemsOf(prs)
  const left = eventItems?.filter(event => !event.allDay && dayKey(startOf(event)) === dayKey(now) && endOf(event) > now)
  const next = eventItems === undefined ? undefined : nextEvent(eventItems.filter(event => dayKey(startOf(event)) === dayKey(now)), now)
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(now))
  const pending = (state: Loaded<unknown>) => t(state === undefined ? 'loading' : 'tile.unavailable')
  return (
    <main className={css.page}>
      <div className={css.column}>
        <header className={css.hero}>
          <p className={css.eyebrow}>{t('title')} · {date}</p>
          <h1 className={css.title}>{t(greeting(now))}</h1>
          <p className={css.summary}>
            {waiting.length === 0 && working === 0 ? t('summary.clear') : t('summary.crew', { waiting: waiting.length, working })}
            {next !== undefined && <> {t('summary.next', { title: next.title, time: relative(startOf(next), now) })}</>}
          </p>
        </header>

        <section className={css.tiles} aria-label={t('tiles')}>
          <Tile label={t('tile.needs')} value={String(waiting.length)} detail={t('tile.needsDetail')} {...waiting.length > 0 ? { tone: 'warn' as const } : {}} />
          <Tile label={t('tile.working')} value={String(working)} detail={t('tile.workingDetail', { count: members.length })} />
          <Tile label={t('tile.meetings')} value={left === undefined ? '—' : String(left.length)}
            detail={left === undefined ? pending(events) : next === undefined ? t('tile.meetingsNone') : t('tile.meetingsNext', { time: relative(startOf(next), now) })} />
          <Tile label={t('tile.prs')} value={prItems === undefined ? '—' : String(prItems.length)} detail={prItems === undefined ? pending(prs) : t('tile.prsDetail')} />
        </section>

        <div className={css.grid}>
          <div className={css.stack}>
            <Section title={t('approvals.title')}>
              {waiting.length === 0
                ? <p className={css.clear}><IconCheckCircleOutlineRegular size={16} />{t('approvals.empty')}</p>
                : (
                  <ul className={css.list}>
                    {waiting.map(member => (
                      <li key={member.id} className={css.ask}>
                        <Face agentId={member.id} design={design(member)} size={36} />
                        <span className={css.askText}>
                          <span className={css.askTitle}>{t('approvals.item', { name: memberName(member) })}</span>
                          <span className={css.muted}>{t('approvals.hint')}</span>
                        </span>
                        <Button size="sm" variant="primary" onClick={() => { openChat(member) }}
                          aria-label={t('approvals.openLabel', { name: memberName(member) })}>{t('approvals.open')}</Button>
                      </li>
                    ))}
                  </ul>
                )}
            </Section>
            <Listed title={t('calendar.title')} state={events} retry={retryEvents} connect={t('calendar.connect')} empty={t('calendar.empty')} t={t}
              render={items => <Week events={items} now={now} t={t} />} />
            <Listed title={t('prs.title')} state={prs} retry={retryPrs} connect={t('prs.connect')} empty={t('prs.empty')} t={t} render={items => (
              <ul className={css.list}>
                {items.map(pr => (
                  <li key={pr.url} className={css.pr}>
                    <a className={css.prTitle} href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a>
                    <span className={css.prMeta}>
                      <span className={css.mono}>{pr.repository}#{pr.number}</span>
                      {pr.draft && <span className={css.pill}>{t('prs.draft')}</span>}
                      <span>{t('prs.updated', { time: relative(new Date(pr.updatedAt).getTime(), now) })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )} />
          </div>

          <aside className={css.stack}>
            <Section title={t('crew.title')} action={<span className={css.muted}>{t('summary.working', { count: working })}</span>}>
              <ul className={css.crew}>
                {members.map(member => (
                  <li key={member.id}>
                    <button type="button" className={css.member} data-status={member.status} onClick={() => { openChat(member) }}
                      aria-label={t('crew.open', { name: memberName(member), status: statusLabel(member) })}>
                      <Face agentId={member.id} design={design(member)} mood={member.status === 'working' ? 'working' : 'idle'} size={30} />
                      <span className={css.memberText}>
                        <span className={css.memberName}>{memberName(member)}</span>
                        <span className={css.memberStatus}>{statusLabel(member)}</span>
                      </span>
                      <span className={css.dot} data-status={member.status} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title={t('stock.title')}><Market stock={stock} symbol={symbol} t={t} /></Section>
            <Section title={t('digest.title')}><p className={css.muted}>{t('digest.empty')}</p></Section>
          </aside>
        </div>
      </div>
    </main>
  )
}
