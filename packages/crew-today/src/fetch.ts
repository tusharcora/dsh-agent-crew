/** Read this week's Google Calendar events and the user's open GitHub pull requests. */
import type { TodayEvent, TodayPullRequest, TodayResult } from './types.ts'

type Fetch = typeof fetch

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Monday 00:00 to the next Monday 00:00 around `now`, in the Host's time zone.
 * @param now - reference time.
 * @returns ISO bounds.
 */
export function weekBounds(now: Date): { readonly start: string; readonly end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Narrow one Calendar API event; cancelled or untimed entries are dropped.
 * @param value - raw `items[]` entry.
 * @returns the event, or undefined.
 */
export function asEvent(value: unknown): TodayEvent | undefined {
  if (!isRecord(value) || value['status'] === 'cancelled' || typeof value['id'] !== 'string') return undefined
  const { start, end } = value
  if (!isRecord(start) || !isRecord(end)) return undefined
  const allDay = typeof start['date'] === 'string'
  const from = allDay ? start['date'] : start['dateTime']
  const to = allDay ? end['date'] : end['dateTime']
  if (typeof from !== 'string' || typeof to !== 'string') return undefined
  const summary = value['summary']
  const link = value['htmlLink']
  return {
    id: value['id'], title: typeof summary === 'string' && summary !== '' ? summary : '(No title)',
    start: from, end: to, allDay, ...typeof link === 'string' ? { url: link } : {},
  }
}

/**
 * Narrow one GitHub search item.
 * @param value - raw `items[]` entry.
 * @returns the pull request, or undefined.
 */
export function asPullRequest(value: unknown): TodayPullRequest | undefined {
  if (!isRecord(value)) return undefined
  const { title, html_url: url, number, updated_at: updatedAt, repository_url: repo, draft } = value
  if (typeof title !== 'string' || typeof url !== 'string' || typeof number !== 'number'
    || typeof updatedAt !== 'string' || typeof repo !== 'string') return undefined
  return { title, url, number, updatedAt, repository: repo.split('/').slice(-2).join('/'), draft: draft === true }
}

async function getJson(fetcher: Fetch, url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetcher(url, { headers, ...signal === undefined ? {} : { signal } })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  return response.json()
}

function failed<T>(error: unknown): TodayResult<T> {
  return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
}

/**
 * This week's events on the primary calendar, earliest first.
 * @param token - Google access token, or undefined when not signed in.
 * @param now - reference time.
 * @param fetcher - fetch implementation.
 * @param signal - optional abort.
 * @returns the events with source and fetch time.
 */
export async function weekEvents(
  token: string | undefined,
  now: Date,
  fetcher: Fetch = fetch,
  signal?: AbortSignal,
): Promise<TodayResult<TodayEvent>> {
  if (token === undefined) return { ok: false, reason: 'not-connected', message: 'Google is not signed in' }
  const { start, end } = weekBounds(now)
  const query = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' })
  try {
    const body = await getJson(fetcher, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`,
      { authorization: `Bearer ${token}` }, signal)
    const items = isRecord(body) && Array.isArray(body['items']) ? body['items'] : []
    return {
      ok: true, items: items.flatMap(item => asEvent(item) ?? []),
      source: { name: 'Google Calendar', url: 'https://calendar.google.com', fetchedAt: now.getTime() },
    }
  } catch (error: unknown) { return failed(error) }
}

/**
 * Open pull requests involving the token's user, most recently updated first.
 * @param token - GitHub token, or undefined when none is stored.
 * @param now - fetch time to record.
 * @param fetcher - fetch implementation.
 * @param signal - optional abort.
 * @returns the pull requests with source and fetch time.
 */
export async function openPullRequests(
  token: string | undefined,
  now: Date,
  fetcher: Fetch = fetch,
  signal?: AbortSignal,
): Promise<TodayResult<TodayPullRequest>> {
  if (token === undefined) return { ok: false, reason: 'not-connected', message: 'No GitHub token is stored' }
  const query = new URLSearchParams({ q: 'is:pr is:open involves:@me archived:false', sort: 'updated', order: 'desc', per_page: '20' })
  try {
    const body = await getJson(fetcher, `https://api.github.com/search/issues?${query.toString()}`, {
      authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28',
    }, signal)
    const items = isRecord(body) && Array.isArray(body['items']) ? body['items'] : []
    return {
      ok: true, items: items.flatMap(item => asPullRequest(item) ?? []),
      source: { name: 'GitHub', url: 'https://github.com/pulls', fetchedAt: now.getTime() },
    }
  } catch (error: unknown) { return failed(error) }
}
