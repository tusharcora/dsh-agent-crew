/** The `ctx.crew` service: live roster plus each member's own chat and chats in a chosen workspace. */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { HostObservable, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { crewRoster, sameRoster, type CrewMemberId, type CrewMemberState } from '../roster.ts'
import type {} from './locales.ts'

/** What the roster asks the rest of the client to do. */
export interface CrewActions {
  /**
   * Show a Session in the main view.
   * @param sessionId - Session to show.
   */
  readonly openSession: (sessionId: SessionId) => void
  /**
   * Start a new Session in a workspace running a preset.
   * @param agentPreset - member preset.
   * @param workspaceId - workspace to start in.
   */
  readonly startInWorkspace: (agentPreset: string, workspaceId: WorkspaceId) => void
  /**
   * Create a member's own chat outside any workspace.
   * @param agentPreset - member preset.
   * @returns the new Session, or undefined when it could not be made.
   */
  readonly createChat: (agentPreset: string) => Promise<SessionId | undefined>
}

/** Live crew roster for other crew plugins. Draw a member with `ctx.crewFaces.Face`, passing the member id as `agentId`. */
export class CrewRoster {
  private snapshot: readonly CrewMemberState[]
  private seen: readonly [SessionListState, SessionStatusSnapshot, WorkspaceSnapshot]
  /** Members in roster order; the snapshot keeps its identity until a member's status or Sessions change. */
  readonly members: HostObservable<readonly CrewMemberState[]>

  /**
   * @param sessions - Session list source.
   * @param status - Session UI status source.
   * @param workspaces - workspace list, which says which Sessions belong to a workspace.
   * @param t - translator bound to the `crew` namespace.
   * @param actions - navigation and Session creation.
   */
  constructor(
    sessions: HostObservable<SessionListState>,
    status: HostObservable<SessionStatusSnapshot>,
    workspaces: HostObservable<WorkspaceSnapshot>,
    private readonly t: TranslateNS<'crew'>,
    private readonly actions: CrewActions,
  ) {
    const fold = ([list, live, places]: readonly [SessionListState, SessionStatusSnapshot, WorkspaceSnapshot]) =>
      crewRoster(list, live, new Set(places.items.flatMap(item => item.sessionIds)))
    this.seen = [sessions.getSnapshot(), status.getSnapshot(), workspaces.getSnapshot()]
    this.snapshot = fold(this.seen)
    this.members = {
      getSnapshot: () => {
        const next = [sessions.getSnapshot(), status.getSnapshot(), workspaces.getSnapshot()] as const
        if (next.every((value, index) => value === this.seen[index])) return this.snapshot
        this.seen = next
        const roster = fold(next)
        if (!sameRoster(this.snapshot, roster)) this.snapshot = roster
        return this.snapshot
      },
      subscribe: (listener) => {
        const off = [sessions.subscribe(listener), status.subscribe(listener), workspaces.subscribe(listener)]
        return () => { for (const dispose of off) dispose() }
      },
    }
  }

  /**
   * Localized member name.
   * @param id - member id.
   * @returns the name in the current locale.
   */
  name(id: CrewMemberId): string {
    return this.t(id)
  }

  /**
   * Localized status label.
   * @param state - member state.
   * @returns the label in the current locale.
   */
  statusLabel(state: CrewMemberState): string {
    return this.t(`status.${state.status}`)
  }

  /**
   * Open the member's chat: the Session waiting on the user, else the one working, else its own chat outside any
   * workspace, which is created when the member has none.
   * @param id - member id.
   * @returns whether a chat was opened.
   */
  async openChat(id: CrewMemberId): Promise<boolean> {
    const focus = this.members.getSnapshot().find(member => member.id === id)?.focus
    if (focus !== undefined) {
      this.actions.openSession(focus)
      return true
    }
    const created = await this.actions.createChat(id)
    if (created === undefined) return false
    this.actions.openSession(created)
    return true
  }

  /**
   * Start a new chat with the member in a workspace, beside its own chat.
   * @param id - member id.
   * @param workspaceId - workspace to work in.
   */
  startInWorkspace(id: CrewMemberId, workspaceId: WorkspaceId): void {
    this.actions.startInWorkspace(id, workspaceId)
  }
}
