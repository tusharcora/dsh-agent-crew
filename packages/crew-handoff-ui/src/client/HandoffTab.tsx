/** Right-panel Handoffs tab body: the current Session's agents and handoffs, live. */
import { useMemo, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-subagent/client'
import { handoffsOf } from './handoffs.ts'
import { HandoffView, type HandoffViewProps } from './HandoffView.tsx'
import { buildHandoffView } from './view.ts'
import type {} from './index.ts'

/** What the tab receives from its registration. */
export interface HandoffTabInjected extends Omit<HandoffViewProps, 'data' | 't'> {
  /** The Session's event window, or undefined when it is not bound in this client. */
  readonly events: SessionEventSource | undefined
}

type Props = Pick<PropsRuntime<'sidebar.right.pane.tab'>, 'sessionId' | 'useProjection' | 'useSessions' | 'useSessionStatus'>
  & PropsLocale<'crewHandoff'> & HandoffTabInjected

const EMPTY = { revision: -1, entries: [] } as const

/**
 * Fold the Session's events and catalog into the view.
 * @param props - standard Session hooks, the event window, view helpers and copy.
 * @returns the view.
 */
export function HandoffTab({ sessionId, useProjection, useSessions, useSessionStatus, events, t, ...view }: Props) {
  const window = useSyncExternalStore(
    listener => events?.subscribe(listener) ?? (() => {}),
    () => events?.getSnapshot() ?? EMPTY,
  )
  const handoffs = useMemo(() => handoffsOf(window.entries), [window])
  const catalog = useProjection('subagentCatalog') ?? []
  const list = useSessions(state => state)
  const status = useSessionStatus(state => state)
  const data = buildHandoffView(sessionId, handoffs, catalog, list, status)
  return <HandoffView data={data} t={t} {...view} />
}
