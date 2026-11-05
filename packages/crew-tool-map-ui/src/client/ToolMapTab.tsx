/** Right-panel Tools tab body: the lead Session and each subagent, loading a subagent's history only while it is selected. */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionEventSource } from '@deepseek-ai/dsh-api-session-controller/client'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-subagent/client'
import { foldTools, toolMap } from './tools.ts'
import { ToolMapView, type MapAgent, type ToolMapViewProps } from './ToolMapView.tsx'
import type {} from './index.ts'

/** A loaded child Session's events, released when the selection changes. */
export interface RetainedEvents {
  readonly events: SessionEventSource
  readonly release: () => void
}

/** What the tab receives from its registration. */
export interface ToolMapTabInjected {
  readonly Face: ToolMapViewProps['Face']
  /** The lead Session's events. */
  readonly events: SessionEventSource | undefined
  /**
   * Load a child Session's history.
   * @param sessionId - child Session.
   * @returns its events and a release, or undefined when it cannot be loaded.
   */
  readonly retain: (sessionId: SessionId) => Promise<RetainedEvents | undefined>
  /** Crew member name and design for a preset, when it is a crew preset. */
  readonly crewFace: (preset: string | undefined) => { readonly name: string; readonly design: CrewFaceProps['design'] } | undefined
}

type Props = Pick<PropsRuntime<'sidebar.right.pane.tab'>, 'sessionId' | 'useProjection' | 'useSessions'>
  & PropsLocale<'crewToolMap'> & ToolMapTabInjected

const EMPTY = { revision: -1, entries: [] } as const
const LEAD = 'lead'

function useEvents(source: SessionEventSource | undefined) {
  return useSyncExternalStore(
    listener => source?.subscribe(listener) ?? (() => {}),
    () => source?.getSnapshot() ?? EMPTY,
  )
}

/**
 * Show the map for the selected agent.
 * @param props - Session hooks, lead events, child loader, faces and copy.
 * @returns the view.
 */
export function ToolMapTab({ sessionId, useProjection, useSessions, events, retain, crewFace, Face, t }: Props) {
  const [selected, setSelected] = useState(LEAD)
  const [child, setChild] = useState<{ readonly key: string; readonly events?: SessionEventSource; readonly failed?: true } | undefined>()
  const catalog = useProjection('subagentCatalog') ?? []
  const presets = useSessions(state => state.byId)
  useEffect(() => {
    if (selected === LEAD) return undefined
    let live = true
    let release: (() => void) | undefined
    setChild({ key: selected })
    void retain(selected as SessionId).then((loaded) => {
      if (!live) { loaded?.release(); return }
      release = loaded?.release
      setChild(loaded === undefined ? { key: selected, failed: true } : { key: selected, events: loaded.events })
    })
    return () => { live = false; release?.() }
  }, [selected, retain])
  const leadWindow = useEvents(events)
  const childWindow = useEvents(child?.key === selected ? child.events : undefined)
  const leadTools = useMemo(() => foldTools(leadWindow.entries), [leadWindow])
  const childTools = useMemo(() => foldTools(childWindow.entries), [childWindow])
  const presetOf = (id: SessionId): string | undefined => {
    const value = presets[id]?.projectionValues?.agentPreset
    return typeof value === 'string' ? value : undefined
  }
  const agent = (key: string, fallback: string, preset: string | undefined): MapAgent => {
    const crew = crewFace(preset)
    return { key, name: crew === undefined ? fallback : key === LEAD ? crew.name : `${fallback} · ${crew.name}`, faceId: preset ?? fallback, ...crew === undefined ? {} : { design: crew.design } }
  }
  const agents: MapAgent[] = [
    agent(LEAD, t('lead'), presetOf(sessionId)),
    ...catalog.map(entry => agent(entry.id, ('name' in entry ? entry.name : undefined) ?? entry.label ?? entry.id, presetOf(entry.id))),
  ]
  const isLead = selected === LEAD
  const loading = !isLead && (child?.key !== selected || (child.events === undefined && child.failed !== true))
  const nodes = isLead ? toolMap(leadTools, []) : loading || child?.failed === true ? undefined : toolMap(childTools, [leadTools])
  return (
    <ToolMapView agents={agents} selected={selected} onSelect={setSelected} nodes={nodes}
      failed={!isLead && child?.key === selected && child.failed === true} Face={Face} t={t} />
  )
}
