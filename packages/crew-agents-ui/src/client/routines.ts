/**
 * Routines: recurring jobs a member runs in its own chat, such as a weekday morning brief. Each one is a dsh schedule
 * whose target is one of the member's Sessions, so the schedule catalog is the only record of them.
 */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScheduleCatalogEntry, ScheduleCreateRequest } from '@deepseek-ai/dsh-schedule/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** ISO weekdays, Monday 1 through Sunday 7. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** One routine as the member editor shows it. */
export interface Routine {
  readonly id: string
  readonly title: string
  readonly prompt: string
  /** ISO weekdays it runs on, ascending. */
  readonly days: readonly number[]
  /** Local time, HH:mm. */
  readonly time: string
  readonly active: boolean
}

/** What the add form collects. */
export interface RoutineDraft {
  readonly title: string
  readonly prompt: string
  readonly days: readonly number[]
  /** Local time, HH:mm. */
  readonly time: string
}

/**
 * The routines delivered into any of a member's Sessions: daily and weekly schedules only, the kinds the editor makes.
 * @param catalog - every schedule on the Host.
 * @param sessions - the member's Sessions.
 * @returns the member's routines, earliest time first.
 */
export function routinesIn(catalog: readonly ScheduleCatalogEntry[], sessions: ReadonlySet<SessionId>): Routine[] {
  return catalog.flatMap((entry): Routine[] => {
    if (entry.status === 'ended' || !('sessionId' in entry.target) || !sessions.has(entry.target.sessionId)) return []
    if (entry.kind !== 'daily' && entry.kind !== 'weekly') return []
    return [{
      id: entry.id, title: entry.title, prompt: entry.prompt, time: entry.time.slice(0, 5), active: entry.status === 'active',
      days: entry.kind === 'daily' ? [...WEEKDAYS] : [...entry.weekdays].sort((left, right) => left - right),
    }]
  }).sort((left, right) => left.time.localeCompare(right.time))
}

/**
 * Why a draft cannot be saved, as a `crew` locale key, or undefined when it can.
 * @param draft - the add form's values.
 * @returns the problem's key.
 */
export function routineProblem(draft: RoutineDraft): 'routine.needsTitle' | 'routine.needsPrompt' | 'routine.needsDays' | 'routine.needsTime' | undefined {
  if (draft.title.trim() === '') return 'routine.needsTitle'
  if (draft.prompt.trim() === '') return 'routine.needsPrompt'
  if (draft.days.length === 0) return 'routine.needsDays'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return 'routine.needsTime'
  return undefined
}

/**
 * The schedule request for a routine delivered into one Session: every day is a daily schedule, fewer days a weekly one.
 * @param draft - the add form's values.
 * @param sessionId - the member's own chat.
 * @param timeZone - the user's IANA zone.
 * @returns the create request.
 */
export function routineRequest(draft: RoutineDraft, sessionId: SessionId, timeZone: string): ScheduleCreateRequest {
  const time = `${draft.time}:00`
  const days = [...new Set(draft.days)].sort((left, right) => left - right)
  return {
    title: draft.title.trim().slice(0, 120), prompt: draft.prompt.trim(),
    timing: days.length === WEEKDAYS.length
      ? { kind: 'daily', daily: { time, time_zone: timeZone } }
      : { kind: 'weekly', weekly: { time, time_zone: timeZone, weekdays: days } },
    target: { kind: 'session', sessionId },
  }
}

/** Schedule calls the store needs; undefined results mean the call failed. */
export interface RoutinesHost {
  readonly catalog: () => Promise<readonly ScheduleCatalogEntry[] | undefined>
  readonly create: (request: ScheduleCreateRequest) => Promise<boolean>
  readonly remove: (id: string) => Promise<boolean>
}

/** The Host's schedule catalog, refreshed on demand; undefined until a read succeeds, as on a dsh without schedules. */
export class RoutinesStore {
  private catalog: readonly ScheduleCatalogEntry[] | undefined = undefined
  private readonly listeners = new Set<() => void>()
  /** Current catalog. */
  readonly source: HostObservable<readonly ScheduleCatalogEntry[] | undefined> = {
    getSnapshot: () => this.catalog,
    subscribe: (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } },
  }

  /** @param host - schedule calls. */
  constructor(private readonly host: RoutinesHost) {}

  /** Read the catalog again; a failed read keeps the last one. */
  async refresh(): Promise<void> {
    const next = await this.host.catalog()
    if (next === undefined) return
    this.catalog = next
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * Add a routine.
   * @param request - the schedule to create.
   * @returns whether the Host stored it.
   */
  async add(request: ScheduleCreateRequest): Promise<boolean> {
    const ok = await this.host.create(request)
    await this.refresh()
    return ok
  }

  /**
   * Delete a routine.
   * @param id - schedule id.
   * @returns whether the Host deleted it.
   */
  async remove(id: string): Promise<boolean> {
    const ok = await this.host.remove(id)
    await this.refresh()
    return ok
  }
}
