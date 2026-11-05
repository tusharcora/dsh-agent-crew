/** Today data shared by the Host Remote and the browser page. Every list names its source and fetch time. */

/** Where a list came from and when. */
export interface TodaySource {
  readonly name: string
  readonly url: string
  /** Epoch milliseconds of the fetch. */
  readonly fetchedAt: number
}

/** One calendar event this week. */
export interface TodayEvent {
  readonly id: string
  readonly title: string
  /** ISO start; a date only (`YYYY-MM-DD`) for an all-day event. */
  readonly start: string
  readonly end: string
  readonly allDay: boolean
  readonly url?: string
}

/** One open pull request involving the user. */
export interface TodayPullRequest {
  readonly title: string
  readonly url: string
  /** `owner/name`. */
  readonly repository: string
  readonly number: number
  readonly draft: boolean
  /** ISO time of the last update. */
  readonly updatedAt: string
}

/** A list, or why there is none. `not-connected` means the account credential is missing. */
export type TodayResult<T> =
  | { readonly ok: true; readonly items: readonly T[]; readonly source: TodaySource }
  | { readonly ok: false; readonly reason: 'not-connected' | 'failed'; readonly message: string }
