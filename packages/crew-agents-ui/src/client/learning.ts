/** Learning state for the Crew tab: proposed lessons waiting for the user and the lessons each member follows. */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewImproveResult, CrewImproveState } from '@deepseek-ai/dsh-experimental-crew-improve/types'

/** What the Learning list shows. */
export interface LearningState {
  readonly loaded: boolean
  readonly data: CrewImproveState | undefined
  /** Whether the last read failed. */
  readonly unavailable: boolean
}

/** Host calls the store needs; each resolves `undefined` when the reply was lost. */
export interface LearningHost {
  readonly learning: () => Promise<CrewImproveState | undefined>
  readonly approve: (proposalId: string) => Promise<CrewImproveResult | undefined>
  readonly reject: (proposalId: string) => Promise<CrewImproveResult | undefined>
  readonly forget: (lessonId: string) => Promise<CrewImproveResult | undefined>
}

/** A decision the user can make; each needs a click in the Crew tab. */
export type LearningDecision = 'approve' | 'reject' | 'forget'

/** Observable learning state with the user's decisions. */
export class LearningStore {
  private state: LearningState = { loaded: false, data: undefined, unavailable: false }
  private readonly listeners = new Set<() => void>()
  /** Current state. */
  readonly source: HostObservable<LearningState> = {
    getSnapshot: () => this.state,
    subscribe: (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } },
  }

  /** @param host - Remote calls. */
  constructor(private readonly host: LearningHost) {}

  /**
   * Read lessons and proposals.
   * @returns after the state updates.
   */
  async refresh(): Promise<void> {
    const data = await this.host.learning()
    this.state = data === undefined ? { ...this.state, loaded: true, unavailable: true } : { loaded: true, data, unavailable: false }
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * Apply one decision the user clicked.
   * @param decision - approve or reject a proposal, or forget a lesson.
   * @param id - proposal or lesson id.
   * @returns undefined on success, else the Host's reason or `failed` when the reply was lost.
   */
  async decide(decision: LearningDecision, id: string): Promise<string | undefined> {
    const result = await this.host[decision](id)
    await this.refresh()
    return result === undefined ? 'failed' : result.ok ? undefined : result.message
  }
}
