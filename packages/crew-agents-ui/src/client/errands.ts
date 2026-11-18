/**
 * Errands: Chief of staff chats given a goal, which dsh's goal round driver keeps working on until it is done, blocked or
 * paused. Each runs in the crew home's `errands` folder; the Session list and its goal projection are the only record.
 */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { GoalRef } from '@deepseek-ai/dsh-goal/client'
import type {} from '@deepseek-ai/dsh-goal/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { isErrandChat } from '../roster.ts'

/** Default and largest goal-round caps offered for a new errand. */
export const DEFAULT_ERRAND_ROUNDS = 30
export const MAX_ERRAND_ROUNDS = 200

/** Where an errand stands, as the page shows it. */
export type ErrandState = 'running' | 'needs-you' | 'paused' | 'blocked' | 'done' | 'stopped'

/** One errand card. */
export interface Errand {
  readonly sessionId: SessionId
  /** The goal's objective, or the chat's title once the goal is cleared. */
  readonly objective: string
  readonly state: ErrandState
  readonly roundsStarted: number
  readonly maxRounds: number
  /** Why it is blocked, while it is. */
  readonly blockedReason?: string
  /** Present while a goal exists; pause, resume and stop act on it. */
  readonly goal?: GoalRef
  readonly updatedAt: number
}

/**
 * Every errand in the Session list, most recently updated first.
 * @param list - Session list, whose rows carry their cwd and goal.
 * @param status - live running and waiting-on-the-user facts.
 * @returns the errands.
 */
export function errandsIn(list: SessionListState, status: SessionStatusSnapshot): Errand[] {
  return Object.values(list.byId).flatMap((summary): Errand[] => {
    if (!isErrandChat(summary)) return []
    const current = summary.projectionValues?.goal ?? null
    const live = status.get(summary.id)
    if (current === null) {
      return [{ sessionId: summary.id, objective: summary.displayTitle, state: 'stopped', roundsStarted: 0, maxRounds: 0, updatedAt: summary.updatedAt }]
    }
    const { goal } = current
    const state: ErrandState = goal.phase === 'complete' ? 'done'
      : goal.phase === 'blocked' ? 'blocked'
        : goal.phase === 'paused' ? 'paused'
          : live?.pendingInteraction !== undefined ? 'needs-you' : 'running'
    return [{
      sessionId: summary.id, objective: goal.objective, state, roundsStarted: current.roundsStarted, maxRounds: goal.maxGoalRounds,
      ...goal.blockedReason === undefined ? {} : { blockedReason: goal.blockedReason.message },
      goal: { id: goal.id, revision: goal.revision }, updatedAt: Math.max(summary.updatedAt, current.updatedAt),
    }]
  }).sort((left, right) => right.updatedAt - left.updatedAt)
}

/**
 * A usable round cap: a whole number from 1 to {@link MAX_ERRAND_ROUNDS}, else the default.
 * @param value - what the form holds.
 * @returns the cap to send.
 */
export function errandRounds(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= MAX_ERRAND_ROUNDS ? value : DEFAULT_ERRAND_ROUNDS
}

/** What starting an errand needs from the rest of the client. */
export interface ErrandStarter {
  /** The errands folder, created when missing. */
  readonly directory: () => Promise<string | undefined>
  /** Create the lead's Session in that folder. */
  readonly create: (cwd: string) => Promise<SessionId | undefined>
  /** Show the Session, which also starts its agent. */
  readonly open: (sessionId: SessionId) => void
  /** Give the Session its goal; false while its agent is not live yet. */
  readonly setGoal: (sessionId: SessionId, objective: string, rounds: number) => Promise<boolean>
  readonly sleep: (ms: number) => Promise<void>
}

/** Why starting failed, as a `crew` locale key. */
export type ErrandStartFailure = 'errand.needsGoal' | 'errand.noFolder' | 'errand.noChat' | 'errand.noGoal'

/**
 * Start an errand: a fresh lead chat in the errands folder, opened, then given its goal. The goal service needs the chat's
 * agent live, which opening starts, so setting the goal is retried for a few seconds.
 * @param starter - client actions.
 * @param objective - what the errand should achieve.
 * @param rounds - goal-round cap.
 * @returns the new chat, or why it failed.
 */
export async function startErrand(
  starter: ErrandStarter, objective: string, rounds: number,
): Promise<{ readonly sessionId: SessionId } | { readonly failure: ErrandStartFailure }> {
  const goal = objective.trim()
  if (goal === '') return { failure: 'errand.needsGoal' }
  const cwd = await starter.directory()
  if (cwd === undefined) return { failure: 'errand.noFolder' }
  const sessionId = await starter.create(cwd)
  if (sessionId === undefined) return { failure: 'errand.noChat' }
  starter.open(sessionId)
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await starter.setGoal(sessionId, goal, errandRounds(rounds))) return { sessionId }
    await starter.sleep(500)
  }
  return { failure: 'errand.noGoal' }
}

/** Observable with getSnapshot/subscribe, as slot hooks read it. */
interface Source<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/**
 * Errand cards as a live source over the Session list and live status, recomputed only when either changes so the
 * snapshot keeps its identity between renders.
 * @param list - Session list source.
 * @param status - live status source.
 * @returns the errands source.
 */
export function errandsSource(list: Source<SessionListState>, status: Source<SessionStatusSnapshot>): Source<readonly Errand[]> {
  let seen: readonly [SessionListState, SessionStatusSnapshot] | undefined
  let value: readonly Errand[] = []
  return {
    getSnapshot: () => {
      const next = [list.getSnapshot(), status.getSnapshot()] as const
      if (seen === undefined || seen[0] !== next[0] || seen[1] !== next[1]) {
        seen = next
        value = errandsIn(next[0], next[1])
      }
      return value
    },
    subscribe: (listener) => {
      const off = [list.subscribe(listener), status.subscribe(listener)]
      return () => { for (const stop of off) stop() }
    },
  }
}
