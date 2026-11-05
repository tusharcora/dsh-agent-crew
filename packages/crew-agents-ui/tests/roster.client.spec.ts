import { describe, expect, it, vi } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { t } from './translate.client.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { CrewRoster, type CrewActions } from '../src/client/crew-roster.ts'
import { CREW_MEMBERS, crewRoster } from '../src/roster.ts'

function row(id: string, agentPreset: string | undefined, running = false, open = false, updatedAt = 0): SessionSummary {
  return {
    id: SessionId(id), displayTitle: id, running, retainedBy: open ? { mainView: 1 } : {}, blank: false, updatedAt,
    ...(agentPreset === undefined ? {} : { projectionValues: { agentPreset } }),
  }
}

function list(...rows: SessionSummary[]): SessionListState {
  return { ids: rows.map(entry => entry.id), byId: Object.fromEntries(rows.map(entry => [entry.id, entry])), phase: 'ready', projectionsBySession: {} }
}

function waiting(id: string): SessionStatus {
  const pendingInteraction = { key: `question:${id}`, kind: 'question', sessionId: SessionId(id) } as NonNullable<SessionStatus['pendingInteraction']>
  return { running: false, pendingInteraction, completionUnread: false }
}

const live = (running: boolean): SessionStatus => ({ running, pendingInteraction: undefined, completionUnread: false })

function source<T>(initial: T): HostObservable<T> & { set: (value: T) => void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    set: (next) => { value = next; for (const listener of listeners) listener() },
  }
}

describe('crewRoster', () => {
  it('lists every member idle when no Session runs a crew preset', () => {
    const roster = crewRoster(list(row('a', 'standard', true), row('b', undefined, true)), new Map())
    expect(roster.map(member => member.id)).toEqual([...CREW_MEMBERS])
    expect(roster.every(member => member.status === 'idle' && member.sessions.length === 0)).toBe(true)
  })

  it('marks a member working while one of its Sessions runs, preferring live status over the listed flag', () => {
    const sessions = list(row('mail-1', 'crew-mail', false), row('code-1', 'crew-code', true))
    const status: SessionStatusSnapshot = new Map([[SessionId('mail-1'), live(true)], [SessionId('code-1'), live(false)]])
    const roster = crewRoster(sessions, status)
    expect(roster.find(member => member.id === 'crew-mail')?.status).toBe('working')
    expect(roster.find(member => member.id === 'crew-code')?.status).toBe('idle')
  })

  it('marks a member as needing the user over working when any of its Sessions awaits an answer', () => {
    const sessions = list(row('life-1', 'crew-life', true), row('life-2', 'crew-life'))
    const roster = crewRoster(sessions, new Map([[SessionId('life-1'), live(true)], [SessionId('life-2'), waiting('life-2')]]))
    const life = roster.find(member => member.id === 'crew-life')
    expect(life?.status).toBe('needs-you')
    expect(life?.sessions).toEqual([SessionId('life-1'), SessionId('life-2')])
    expect(life?.focus).toBe(SessionId('life-2'))
  })

  it('marks the member whose Session is open in the main view and focuses a running Session over an older one', () => {
    const sessions = list(row('code-old', 'crew-code'), row('code-run', 'crew-code', true), row('mail-1', 'crew-mail', false, true))
    const roster = crewRoster(sessions, new Map())
    expect(roster.find(member => member.id === 'crew-code')).toMatchObject({ open: false, focus: SessionId('code-run') })
    expect(roster.find(member => member.id === 'crew-mail')).toMatchObject({ open: true, status: 'idle', focus: SessionId('mail-1') })
    expect(roster.find(member => member.id === 'crew-life')?.focus).toBeUndefined()
  })
})

function places(...members: SessionId[][]): WorkspaceSnapshot {
  return {
    items: members.map((sessionIds, index) => ({
      workspaceId: `ws-${String(index)}` as WorkspaceId, path: `/w${String(index)}`, title: `W${String(index)}`, sessionIds, createdAt: '', updatedAt: '',
    })),
    archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }
}

function actions() {
  return { openSession: vi.fn(), startInWorkspace: vi.fn(), createChat: vi.fn(async (): Promise<SessionId | undefined> => SessionId('new-chat')) } satisfies CrewActions
}

describe('home chats', () => {
  it('makes a member\'s latest Session outside any workspace its own chat, and opens it when nothing is waiting or running', () => {
    const sessions = list(row('code-ws', 'crew-code', false, false, 30), row('code-home-old', 'crew-code', false, false, 10),
      row('code-home', 'crew-code', false, false, 20))
    const roster = crewRoster(sessions, new Map(), new Set([SessionId('code-ws')]))
    expect(roster.find(member => member.id === 'crew-code')).toMatchObject({ home: SessionId('code-home'), focus: SessionId('code-home') })
  })

  it('opens a workspace Session over the own chat while it runs', () => {
    const sessions = list(row('code-ws', 'crew-code', true, false, 5), row('code-home', 'crew-code', false, false, 20))
    const roster = crewRoster(sessions, new Map(), new Set([SessionId('code-ws')]))
    expect(roster.find(member => member.id === 'crew-code')?.focus).toBe(SessionId('code-ws'))
  })
})

describe('CrewRoster', () => {
  it('keeps the snapshot identity until a member changes, then notifies subscribers', () => {
    const sessions = source(list(row('mail-1', 'crew-mail')))
    const status = source<SessionStatusSnapshot>(new Map())
    const roster = new CrewRoster(sessions, status, source(places()), t, actions())
    const first = roster.members.getSnapshot()
    const listener = vi.fn()
    roster.members.subscribe(listener)
    status.set(new Map())
    expect(roster.members.getSnapshot()).toBe(first)
    status.set(new Map([[SessionId('mail-1'), live(true)]]))
    const next = roster.members.getSnapshot()
    expect(next).not.toBe(first)
    expect(next.find(member => member.id === 'crew-mail')?.status).toBe('working')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('opens a member\'s existing chat without creating one', async () => {
    const act = actions()
    const roster = new CrewRoster(source(list(row('life-1', 'crew-life'))), source<SessionStatusSnapshot>(new Map()), source(places()),
      t, act)
    expect(await roster.openChat('crew-life')).toBe(true)
    expect(act.openSession).toHaveBeenCalledWith(SessionId('life-1'))
    expect(act.createChat).not.toHaveBeenCalled()
  })

  it('creates a member\'s own chat outside any workspace when it has none, and reports failure', async () => {
    const act = actions()
    const roster = new CrewRoster(source(list()), source<SessionStatusSnapshot>(new Map()), source(places()), t, act)
    expect(await roster.openChat('crew-research')).toBe(true)
    expect(act.createChat).toHaveBeenCalledWith('crew-research')
    expect(act.openSession).toHaveBeenCalledWith(SessionId('new-chat'))
    const failing = { ...actions(), openSession: vi.fn(), createChat: vi.fn(async () => undefined) } satisfies CrewActions
    const other = new CrewRoster(source(list()), source<SessionStatusSnapshot>(new Map()), source(places()), t, failing)
    expect(await other.openChat('crew-mail')).toBe(false)
    expect(failing.openSession).not.toHaveBeenCalled()
  })

  it('starts a chat in a chosen workspace with the member preset, and names members and statuses', () => {
    const act = actions()
    const roster = new CrewRoster(source(list()), source<SessionStatusSnapshot>(new Map()), source(places()), t, act)
    roster.startInWorkspace('crew-code', 'ws-1' as WorkspaceId)
    expect(act.startInWorkspace).toHaveBeenCalledWith('crew-code', 'ws-1')
    expect(roster.name('crew-chief')).toBe('Chief of staff')
    expect(roster.statusLabel({ id: 'crew-mail', status: 'needs-you', sessions: [], open: false, home: undefined, focus: undefined }))
      .toBe('Needs you')
  })
})
