/**
 * Crew today, Host half: this week's Google Calendar events and the user's open GitHub pull requests, read with the
 * credentials crew-connections stores. Read-only: nothing here sends, merges or books.
 * @module @deepseek-ai/dsh-crew-today
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { CREW_REFS } from '@deepseek-ai/dsh-crew-connections'
import { openPullRequests, weekEvents } from './fetch.ts'
import type { TodayEvent, TodayPullRequest, TodayResult } from './types.ts'

export type { TodayEvent, TodayPullRequest, TodayResult, TodaySource } from './types.ts'
export { asEvent, asPullRequest, openPullRequests, weekBounds, weekEvents } from './fetch.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Calendar and pull requests for the Today page. */
    crewToday: CrewToday
  }
}

/** Reads the Today page's account data. */
export class CrewToday extends TypertRemoteService {
  static inject = ['credentials']

  /** @param ctx - owning plugin context. */
  constructor(ctx: Context) {
    super(ctx, 'crewToday')
  }

  protected [Service.init](): void {}

  private async secret(ref: string): Promise<string | undefined> {
    return (await this.ctx.credentials.resolve(credentialRef(ref)))?.value
  }

  /**
   * This week's events on the primary Google calendar.
   * @returns events with source and fetch time, or why there are none.
   */
  @Remote('calendar')
  async calendar(): Promise<TodayResult<TodayEvent>> {
    return weekEvents(await this.secret(CREW_REFS.googleAccessToken), new Date())
  }

  /**
   * Open GitHub pull requests involving the user.
   * @returns pull requests with source and fetch time, or why there are none.
   */
  @Remote('pullRequests')
  async pullRequests(): Promise<TodayResult<TodayPullRequest>> {
    return openPullRequests(await this.secret(CREW_REFS.githubToken), new Date())
  }
}

export default CrewToday
