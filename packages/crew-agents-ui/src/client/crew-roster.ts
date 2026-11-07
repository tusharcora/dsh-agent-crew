/** The `ctx.crew` service: live roster plus each member's own chat and chats in a chosen workspace. */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { HostObservable, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { FaceDesign } from '@deepseek-ai/dsh-crew-faces'
import type { CrewMember, RosterResult, RosterState } from '@deepseek-ai/dsh-crew-roster/types'
import { crewRoster, sameRoster, type CrewMemberId, type CrewMemberState, type RosterEntry } from '../roster.ts'
import { en } from './locales.ts'

/**
 * The most recently updated workspace: where a member's chat opens on a dsh whose composer cannot run a chat
 * outside any workspace.
 * @param snapshot - workspace list.
 * @returns the workspace id, or undefined when there is none.
 */
export function latestWorkspace(snapshot: WorkspaceSnapshot): WorkspaceId | undefined {
  let latest: WorkspaceSnapshot['items'][number] | undefined
  for (const item of snapshot.items) {
    if (latest === undefined || Date.parse(item.updatedAt) > Date.parse(latest.updatedAt)) latest = item
  }
  return latest?.workspaceId
}

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

/** Roster reads and changes on the Host; each resolves undefined when dsh could not be reached. */
export interface RosterHost {
  readonly state: () => Promise<RosterState | undefined>
  readonly save: (member: CrewMember) => Promise<RosterResult<CrewMember> | undefined>
  readonly remove: (id: string) => Promise<RosterResult | undefined>
}

/** The editable crew as the Crew tab reads it. */
export interface RosterView {
  readonly loaded: boolean
  /** True when the last read could not reach dsh. */
  readonly failed: boolean
  readonly records: RosterState['members']
  readonly connections: RosterState['connections']
}

const SHIPPED = ['crew-chief', 'crew-mail', 'crew-chat', 'crew-code', 'crew-research', 'crew-life'] as const

function isShipped(id: string): id is (typeof SHIPPED)[number] {
  return (SHIPPED as readonly string[]).includes(id)
}

/** Live crew roster for other crew plugins. Draw a member with `ctx.crewFaces.Face`, passing the member id as `agentId`. */
export class CrewRoster {
  private snapshot: readonly CrewMemberState[]
  private seen: readonly [SessionListState, SessionStatusSnapshot, WorkspaceSnapshot, RosterView]
  private view: RosterView = { loaded: false, failed: false, records: [], connections: [] }
  private readonly listeners = new Set<() => void>()
  private editing: CrewMemberId | undefined
  private readonly editListeners = new Set<() => void>()
  /** A member the sidebar asked the Crew tab to edit; `''` asks for a new member. */
  readonly editRequest: HostObservable<CrewMemberId | undefined> = {
    getSnapshot: () => this.editing,
    subscribe: (listener) => { this.editListeners.add(listener); return () => { this.editListeners.delete(listener) } },
  }
  /** Members in roster order; the snapshot keeps its identity until a member's status or Sessions change. */
  readonly members: HostObservable<readonly CrewMemberState[]>
  /** The stored crew and the services members can connect to, for the editor. */
  readonly roster: HostObservable<RosterView> = {
    getSnapshot: () => this.view,
    subscribe: (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } },
  }

  /**
   * @param sessions - Session list source.
   * @param status - Session UI status source.
   * @param workspaces - workspace list, which says which Sessions belong to a workspace.
   * @param t - translator bound to the `crew` namespace.
   * @param actions - navigation and Session creation.
   * @param host - roster reads and changes.
   */
  constructor(
    sessions: HostObservable<SessionListState>,
    status: HostObservable<SessionStatusSnapshot>,
    workspaces: HostObservable<WorkspaceSnapshot>,
    private readonly t: TranslateNS<'crew'>,
    private readonly actions: CrewActions,
    private readonly host: RosterHost,
  ) {
    const fold = ([list, live, places, view]: readonly [SessionListState, SessionStatusSnapshot, WorkspaceSnapshot, RosterView]) =>
      crewRoster(list, live, new Set(places.items.flatMap(item => item.sessionIds)), view.records.map(record => this.entry(record)))
    this.seen = [sessions.getSnapshot(), status.getSnapshot(), workspaces.getSnapshot(), this.view]
    this.snapshot = fold(this.seen)
    this.members = {
      getSnapshot: () => {
        const next = [sessions.getSnapshot(), status.getSnapshot(), workspaces.getSnapshot(), this.view] as const
        if (next.every((value, index) => value === this.seen[index])) return this.snapshot
        this.seen = next
        const roster = fold(next)
        if (!sameRoster(this.snapshot, roster)) this.snapshot = roster
        return this.snapshot
      },
      subscribe: (listener) => {
        const off = [sessions, status, workspaces, this.roster].map(observable => observable.subscribe(listener))
        return () => { for (const dispose of off) dispose() }
      },
    }
  }

  private entry(record: CrewMember): RosterEntry {
    // A shipped member keeps its translated name until the user renames it.
    const name = record.builtIn === true && isShipped(record.id) && record.name === en[record.id] ? this.t(record.id) : record.name
    return { id: record.id, name, face: record.face }
  }

  private publish(next: RosterView): void {
    this.view = next
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * Ask the Crew tab to open the editor.
   * @param id - member to edit, or `''` for a new member; undefined clears the request.
   */
  requestEdit(id: CrewMemberId | undefined): void {
    this.editing = id
    for (const listener of [...this.editListeners]) listener()
  }

  /** Read the stored crew again. */
  async refresh(): Promise<void> {
    const state = await this.host.state()
    this.publish(state === undefined
      ? { ...this.view, loaded: true, failed: true }
      : { loaded: true, failed: false, records: state.members, connections: state.connections })
  }

  /**
   * Add a member (empty id) or save changes to one.
   * @param member - the edited record.
   * @returns the saved record, or the message to show.
   */
  async save(member: CrewMember): Promise<{ readonly saved: CrewMember } | { readonly message: string }> {
    const result = await this.host.save(member)
    await this.refresh()
    if (result === undefined) return { message: this.t('edit.unreachable') }
    return result.ok ? { saved: result.value } : { message: result.message }
  }

  /**
   * Remove a member.
   * @param id - member id.
   * @returns undefined once removed, or the message to show.
   */
  async remove(id: CrewMemberId): Promise<string | undefined> {
    const result = await this.host.remove(id)
    await this.refresh()
    if (result === undefined) return this.t('edit.unreachable')
    return result.ok ? undefined : result.message
  }

  /**
   * The member's designed body and colour, for pages that draw it with `ctx.crewFaces.Face`.
   * @param id - member id.
   * @returns the face design, or undefined for an id not on the roster.
   */
  design(id: CrewMemberId): FaceDesign | undefined {
    return this.view.records.find(record => record.id === id)?.face
  }

  /**
   * Member display name.
   * @param id - member id.
   * @returns the name, or the id for one not on the roster.
   */
  name(id: CrewMemberId): string {
    const record = this.view.records.find(entry => entry.id === id)
    return record === undefined ? id : this.entry(record).name
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
