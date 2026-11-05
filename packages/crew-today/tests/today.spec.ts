import { describe, expect, it, vi } from 'vitest'
import { asEvent, asPullRequest, openPullRequests, weekBounds, weekEvents } from '../src/fetch.ts'

const now = new Date(2026, 10, 5, 9, 30) // a Thursday
const json = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('weekBounds', () => {
  it('runs Monday 00:00 to the next Monday', () => {
    const { start, end } = weekBounds(now)
    expect(new Date(start)).toEqual(new Date(2026, 10, 2))
    expect(new Date(end)).toEqual(new Date(2026, 10, 9))
  })
})

describe('calendar', () => {
  it('says not connected without a token and never calls Google', async () => {
    const fetcher = json({})
    expect(await weekEvents(undefined, now, fetcher)).toMatchObject({ ok: false, reason: 'not-connected' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps timed and all-day events, drops cancelled ones, and names its source and fetch time', async () => {
    const fetcher = json({ items: [
      { id: 'a', summary: 'Standup', start: { dateTime: '2026-11-05T10:00:00-05:00' }, end: { dateTime: '2026-11-05T10:15:00-05:00' }, htmlLink: 'https://c/a' },
      { id: 'b', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } },
      { id: 'c', status: 'cancelled', start: { date: '2026-11-06' }, end: { date: '2026-11-07' } },
    ] })
    const result = await weekEvents('tok', now, fetcher)
    expect(result).toMatchObject({ ok: true, source: { name: 'Google Calendar', fetchedAt: now.getTime() } })
    expect(result.ok && result.items.map(e => [e.id, e.title, e.allDay])).toEqual([['a', 'Standup', false], ['b', '(No title)', true]])
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('calendars/primary/events')
  })

  it('reports a failed request', async () => {
    expect(await weekEvents('tok', now, json({}, 401))).toMatchObject({ ok: false, reason: 'failed', message: 'HTTP 401' })
  })

  it('ignores malformed entries', () => {
    expect(asEvent({ id: 'x' })).toBeUndefined()
  })
})

describe('pull requests', () => {
  it('says not connected without a token', async () => {
    expect(await openPullRequests(undefined, now, json({}))).toMatchObject({ ok: false, reason: 'not-connected' })
  })

  it('reads repository, number and draft state with source and fetch time', async () => {
    const result = await openPullRequests('tok', now, json({ items: [{
      title: 'Crew plugins', html_url: 'https://github.com/o/r/pull/1', number: 1, updated_at: '2026-11-05T05:00:00Z',
      repository_url: 'https://api.github.com/repos/o/r', draft: false,
    }, { title: 'broken' }] }))
    expect(result).toMatchObject({ ok: true, source: { name: 'GitHub', fetchedAt: now.getTime() } })
    expect(result.ok && result.items).toEqual([{ title: 'Crew plugins', url: 'https://github.com/o/r/pull/1', number: 1,
      updatedAt: '2026-11-05T05:00:00Z', repository: 'o/r', draft: false }])
    expect(asPullRequest(null)).toBeUndefined()
  })
})
