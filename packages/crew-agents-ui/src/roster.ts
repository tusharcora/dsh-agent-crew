/** Crew members and their live status, derived from the Session list and Session UI status. */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: brings the `mainView` reference source into `retainedBy`.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the `agentPreset` Session projection value into this program.
import type {} from '@deepseek-ai/dsh-agent-preset-registry/types'
import type { FaceDesign } from '@deepseek-ai/dsh-crew-faces'

/** One crew member, identified by its preset id (`crew-` and lowercase letters). */
export type CrewMemberId = string

/** What the roster needs of a member record: its id, display name and face. */
export interface RosterEntry {
  readonly id: CrewMemberId
  readonly name: string
  readonly face: FaceDesign
}

/** `needs-you` while any of the member's Sessions awaits the user, else `working` while one runs, else `idle`. */
export type CrewStatus = 'working' | 'needs-you' | 'idle'

/** One member's live state. */
export interface CrewMemberState {
  readonly id: CrewMemberId
  /** Display name, in the current locale for a shipped member the user has not renamed. */
  readonly name: string
  readonly face: FaceDesign
  readonly status: CrewStatus
  /** Listed Sessions running this member's preset, in list order. */
  readonly sessions: readonly SessionId[]
  /** Whether one of the member's Sessions is open in the main view. */
  readonly open: boolean
  /** The member's own chat: its most recently updated Session outside any workspace. */
  readonly home: SessionId | undefined
  /** Session to open for this member: the one awaiting the user, else one running, else its own chat, else the latest. */
  readonly focus: SessionId | undefined
}

/**
 * Fold the Session list and UI status into one state per crew member.
 * @param list - Session list, whose rows carry their recorded preset.
 * @param status - running and pending-interaction facts by Session.
 * @param inWorkspace - Sessions that belong to a workspace; the rest are members' own chats.
 * @param entries - the crew, in roster order.
 * @returns every member in roster order.
 */
export function crewRoster(
  list: SessionListState, status: SessionStatusSnapshot, inWorkspace: ReadonlySet<SessionId>, entries: readonly RosterEntry[],
): readonly CrewMemberState[] {
  interface Fold {
    sessions: SessionId[]
    working: SessionId | undefined
    needsYou: SessionId | undefined
    open: boolean
    home: { readonly id: SessionId; readonly updatedAt: number } | undefined
    latest: { readonly id: SessionId; readonly updatedAt: number } | undefined
  }
  const members = new Map<string, Fold>(
    entries.map(({ id }) => [id, {
      sessions: [], working: undefined, needsYou: undefined, open: false, home: undefined, latest: undefined,
    }]),
  )
  for (const summary of Object.values(list.byId)) {
    const preset = presetOf(summary)
    const member = preset === undefined ? undefined : members.get(preset)
    if (member === undefined) continue
    const live = status.get(summary.id)
    member.sessions.push(summary.id)
    if (live?.pendingInteraction !== undefined) member.needsYou ??= summary.id
    if (live?.running ?? summary.running) member.working ??= summary.id
    if ((summary.retainedBy.mainView ?? 0) > 0) member.open = true
    const stamp = { id: summary.id, updatedAt: summary.updatedAt }
    if (member.latest === undefined || summary.updatedAt > member.latest.updatedAt) member.latest = stamp
    if (!inWorkspace.has(summary.id) && (member.home === undefined || summary.updatedAt > member.home.updatedAt)) member.home = stamp
  }
  return entries.map(({ id, name, face }) => {
    const member = members.get(id)
    const state: CrewStatus = member?.needsYou !== undefined ? 'needs-you' : member?.working !== undefined ? 'working' : 'idle'
    return {
      id, name, face, status: state, sessions: member?.sessions ?? [], open: member?.open ?? false, home: member?.home?.id,
      focus: member?.needsYou ?? member?.working ?? member?.home?.id ?? member?.latest?.id,
    }
  })
}

/**
 * The preset a listed Session runs. A row listed before its projections are cached carries none; a member's own chat
 * still runs in `crew/<member id>`, so its folder names the member.
 * @param summary - Session list row.
 * @returns the preset id, or undefined when the row says nothing about one.
 */
export function presetOf(summary: Pick<SessionSummary, 'projectionValues' | 'cwd'>): string | undefined {
  const preset = summary.projectionValues?.agentPreset
  if (typeof preset === 'string') return preset
  return /[\\/]crew[\\/](crew-[a-z]+)[\\/]?$/.exec(summary.cwd ?? '')?.[1]
}

/**
 * Members' own chats: Sessions running a crew preset outside every workspace, which the Crew tab lists instead of the
 * sidebar's Ungrouped bucket.
 * @param list - Session list, whose rows carry their recorded preset.
 * @param inWorkspace - Sessions that belong to a workspace.
 * @param members - crew member ids.
 * @returns the own-chat Session ids, in list order.
 */
export function memberChats(list: SessionListState, inWorkspace: ReadonlySet<SessionId>, members: ReadonlySet<CrewMemberId>): SessionId[] {
  return list.ids.filter((id) => {
    const summary = list.byId[id]
    const preset = summary === undefined ? undefined : presetOf(summary)
    return preset !== undefined && members.has(preset) && !inWorkspace.has(id)
  })
}

/**
 * Compare two rosters by value, so an unchanged roster keeps its snapshot identity.
 * @param left - previous roster.
 * @param right - next roster.
 * @returns whether both hold the same members, statuses and Sessions.
 */
export function sameRoster(left: readonly CrewMemberState[], right: readonly CrewMemberState[]): boolean {
  return left.length === right.length && left.every((member, index) => {
    const other = right[index]
    return other !== undefined && member.id === other.id && member.status === other.status && member.name === other.name
      && member.face.body === other.face.body && member.face.color === other.face.color
      && member.open === other.open && member.focus === other.focus && member.home === other.home
      && member.sessions.length === other.sessions.length && member.sessions.every((id, at) => id === other.sessions[at])
  })
}
