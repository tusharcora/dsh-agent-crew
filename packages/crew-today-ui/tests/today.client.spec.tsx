// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewMemberState } from '@deepseek-ai/dsh-crew-agents-ui/client'
import type { StockChartCards } from '@deepseek-ai/dsh-crew-stock-chart-ui/client'
import type { TodayEvent, TodayPullRequest, TodayResult } from '@deepseek-ai/dsh-crew-today/types'
// The namespace declaration `TranslateNS<'crewToday'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { TodayPage } from '../src/client/TodayPage.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewToday'> = (key, params) => translate(key, params)
const source = { name: 'GitHub', url: 'https://github.com/pulls', fetchedAt: Date.UTC(2026, 10, 5, 12) }

const members: CrewMemberState[] = [
  { id: 'crew-mail', status: 'needs-you', sessions: [], open: false, home: undefined, focus: undefined },
  { id: 'crew-code', status: 'idle', sessions: [], open: false, home: undefined, focus: undefined },
]

function stock(quote: StockChartCards['quote']): StockChartCards {
  return { Card: ({ initial }) => <p>card {initial.symbol}</p>, quote, t: (key: string) => key }
}

async function mount(over: {
  calendar?: () => Promise<TodayResult<TodayEvent> | undefined>
  pullRequests?: () => Promise<TodayResult<TodayPullRequest> | undefined>
  quote?: StockChartCards['quote']
} = {}) {
  const openChat = vi.fn()
  await act(async () => {
    render(<TodayPage useMembers={selector => selector(members)} Face={() => <svg />} design={() => ({ body: 'orb', color: '#0B0B0C' })}
      memberName={member => member.id.slice(5)} statusLabel={member => member.status} openChat={openChat}
      stock={stock(over.quote ?? (async () => undefined))} symbol="^GSPC"
      calendar={over.calendar ?? (async () => ({ ok: false, reason: 'not-connected', message: '' }))}
      pullRequests={over.pullRequests ?? (async () => ({ ok: false, reason: 'not-connected', message: '' }))} t={t} />)
  })
  return openChat
}

it('shows every crew member and opens the one waiting for you from its approval card', async () => {
  const openChat = await mount()
  expect(screen.getByRole('button', { name: 'Open mail’s chat: needs-you' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Open code’s chat: idle' })).toBeTruthy()
  expect(screen.getByText('mail is waiting for your decision')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Review what mail is asking' }))
  expect(openChat).toHaveBeenCalledWith(members[0])
})

it('asks to connect accounts instead of showing invented events, and labels the empty digest', async () => {
  await mount()
  expect(screen.getByText(/Connect calendar/)).toBeTruthy()
  expect(screen.getByText(/Connect GitHub/)).toBeTruthy()
  expect(screen.getByText(/No digest yet/)).toBeTruthy()
  expect(screen.getByText('Couldn’t load ^GSPC.')).toBeTruthy()
})

it('lists pull requests with their source and fetch time, and says when there are none', async () => {
  await mount({
    pullRequests: async () => ({ ok: true, source, items: [
      { title: 'Crew plugins', url: 'https://github.com/o/r/pull/1', repository: 'o/r', number: 1, draft: true, updatedAt: '2026-11-05T05:00:00Z' },
    ] }),
    calendar: async () => ({ ok: true, items: [], source: { ...source, name: 'Google Calendar' } }),
  })
  expect(screen.getByRole('link', { name: 'Crew plugins' }).getAttribute('href')).toBe('https://github.com/o/r/pull/1')
  expect(screen.getByText('o/r#1')).toBeTruthy()
  expect(screen.getByText('Draft')).toBeTruthy()
  expect(screen.getByText(/Source: GitHub · fetched/)).toBeTruthy()
  expect(screen.getByText('Nothing on your calendar this week.')).toBeTruthy()
  expect(screen.getByText(/Source: Google Calendar · fetched/)).toBeTruthy()
})

it('reports a failed load and retries on click', async () => {
  const calendar = vi.fn()
    .mockResolvedValueOnce({ ok: false, reason: 'failed', message: 'HTTP 401' })
    .mockResolvedValueOnce({ ok: true, source, items: [{ id: 'a', title: 'Standup', start: '2026-11-05T15:00:00Z', end: '2026-11-05T15:15:00Z', allDay: false }] })
  await mount({ calendar })
  expect(screen.getByText(/Couldn’t load: HTTP 401/)).toBeTruthy()
  await act(async () => { fireEvent.click(within(screen.getByRole('region', { name: 'This week' })).getByRole('button', { name: 'Retry' })) })
  expect(screen.getByText('Standup')).toBeTruthy()
  expect(calendar).toHaveBeenCalledTimes(2)
})

it('shows the market card once a quote arrives', async () => {
  await mount({ quote: async () => ({ ok: true, series: { symbol: '^GSPC' } as never }) })
  expect(screen.getByText('card ^GSPC')).toBeTruthy()
})
