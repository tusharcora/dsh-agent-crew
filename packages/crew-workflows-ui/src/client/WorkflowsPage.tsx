/**
 * The Workflows page: a searchable list of saved workflows on the left; on the right the home screen, the New workflow
 * form, or the builder with that workflow's runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, IconPlusOutlineRegular, IconSearchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDefinition, WorkflowKind, WorkflowRunRecord, WorkflowsState } from '@deepseek-ai/dsh-crew-workflows/types'
import { Editor, type EditorProps } from './Editor.tsx'
import { NewWorkflow } from './NewWorkflow.tsx'
import { RunView, ago, duration, type HandoffsWithCopy, type Member } from './RunView.tsx'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** What the page reads and does. */
export interface WorkflowsPageInjected {
  /** Read the saved workflows and runs; undefined when dsh could not be reached. */
  readonly load: () => Promise<WorkflowsState | undefined>
  readonly save: EditorProps['save']
  readonly remove: (id: string) => Promise<boolean>
  readonly run: EditorProps['run']
  readonly cancel: (runId: string) => void
  readonly members: readonly Member[]
  readonly handoffs: HandoffsWithCopy
}

type Props = InjectFace<WorkflowsPageInjected> & PropsLocale<'crewWorkflows'>

/** How often the page re-reads runs while one is running, and otherwise. */
const FAST_MS = 2000
const SLOW_MS = 15_000
const KINDS: readonly WorkflowKind[] = ['agentic', 'fixed']

/**
 * Render the page.
 * @param props - loaders, actions, crew members, the shared handoff view and copy.
 * @returns the page.
 */
export function WorkflowsPage({ load, save, remove, run, cancel, members, handoffs, t }: Props) {
  const [state, setState] = useState<WorkflowsState | undefined>()
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<WorkflowDefinition | undefined>()
  const [editorKey, setEditorKey] = useState(0)
  const [runId, setRunId] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const runsRef = useRef<HTMLElement>(null)
  const [creating, setCreating] = useState(false)
  const refresh = useCallback(async () => {
    const next = await load()
    setFailed(next === undefined)
    if (next !== undefined) setState(next)
  }, [load])
  const running = state?.runs.some(entry => entry.status === 'running') === true
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, running ? FAST_MS : SLOW_MS)
    return () => { clearInterval(timer) }
  }, [refresh, running])
  const open = (definition: WorkflowDefinition) => {
    setCreating(false)
    setSelected(definition)
    setEditorKey(key => key + 1)
    setRunId(undefined)
  }
  const runsOf = (id: string | undefined): WorkflowRunRecord[] => state?.runs.filter(entry => entry.workflowId === id).toReversed() ?? []
  const runs = runsOf(selected?.id)
  const shown = runs.find(entry => entry.runId === runId) ?? runs[0]
  const needle = query.trim().toLowerCase()
  const listed = state?.workflows.filter(definition => needle === '' || `${definition.name} ${definition.description}`.toLowerCase().includes(needle)) ?? []
  const showRuns = () => { runsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return (
    <main className={css.page}>
      <aside className={css.side} aria-label={t('list')}>
        <p className={css.railTitle}>{t('title')}</p>
        <label className={css.search}>
          <IconSearchOutlineRegular size={14} />
          <input type="search" value={query} placeholder={t('search')} aria-label={t('search')}
            onChange={(event) => { setQuery(event.target.value) }} />
        </label>
        {failed && <p className={css.bad} role="alert">{t('failed')}</p>}
        {state !== undefined && state.workflows.length === 0 && <p className={css.muted}>{t('empty')}</p>}
        {state !== undefined && state.workflows.length > 0 && listed.length === 0 && <p className={css.muted}>{t('noMatch')}</p>}
        {KINDS.filter(kind => listed.some(definition => definition.kind === kind)).map(kind => (
          <div key={kind} className={css.group} role="group" aria-label={t(`kind.${kind}`)}>
            <p className={css.groupTitle}>{t(`kind.${kind}`)}</p>
            <ul className={css.list}>
              {listed.filter(definition => definition.kind === kind).map((definition) => {
                const last = runsOf(definition.id)[0]
                return (
                  <li key={definition.id}>
                    <button type="button" className={css.item} aria-current={definition.id === selected?.id || undefined} onClick={() => { open(definition) }}>
                      <span className={css.tile} data-kind={definition.kind} aria-hidden="true">{t(`kind.${definition.kind}`).slice(0, 1)}</span>
                      <span className={css.itemText}>
                        <span className={css.itemName}>{definition.name}</span>
                        <span className={css.itemMeta}>
                          {t('steps.count', { count: definition.steps.length })}
                          {definition.draft === true && <span className={css.draftMark}>{t('draft')}</span>}
                        </span>
                      </span>
                      {last !== undefined && (
                        <span className={css.lastRun} data-status={last.status} title={t(`run.status.${last.status}`)}>
                          <span className={css.dot} />{ago(last.startedAt)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <span className={css.grow} />
        <button type="button" className={css.newWorkflow} onClick={() => { setSelected(undefined); setCreating(true) }}>
          <IconPlusOutlineRegular size={14} />{t('new')}
        </button>
      </aside>
      <div className={css.main}>
        {creating && <NewWorkflow t={t} onCreate={open} onCancel={() => { setCreating(false) }} />}
        {selected === undefined && !creating && (
          <section className={css.start} aria-label={t('start.title')}>
            <header className={css.pageHeadRow}>
              <div className={css.pageHead}>
                <h1 className={css.title}>{t('title')}</h1>
                <p className={css.lede}>{t('intro')}</p>
              </div>
              <Button variant="primary" icon={<IconPlusOutlineRegular size={14} />} onClick={() => { setCreating(true) }}>{t('new')}</Button>
            </header>
            {state !== undefined && state.workflows.length === 0 && (
              <div className={css.emptyState}>
                <p className={css.startTitle}>{t('empty')}</p>
                <p className={css.muted}>{t('start.body')}</p>
                <Button variant="outline" icon={<IconPlusOutlineRegular size={14} />} onClick={() => { setCreating(true) }}>{t('new')}</Button>
              </div>
            )}
            {state !== undefined && state.workflows.length > 0 && (
              <div className={css.library} role="table" aria-label={t('library')}>
                <div className={css.libraryRow} role="row" data-head>
                  <span role="columnheader">{t('library.workflow')}</span>
                  <span role="columnheader">{t('library.crew')}</span>
                  <span role="columnheader">{t('library.last')}</span>
                  <span role="columnheader">{t('library.history')}</span>
                  <span role="columnheader">{t('library.avg')}</span>
                </div>
                {state.workflows.map((definition) => {
                  const history = runsOf(definition.id)
                  const last = history[0]
                  const finished = history.filter(entry => entry.status === 'completed' && entry.endedAt !== undefined)
                  const took = finished.reduce((sum, entry) => sum + ((entry.endedAt ?? entry.startedAt) - entry.startedAt), 0)
                  const avg = finished.length === 0 ? undefined : took / finished.length
                  const crew = [...new Set(definition.steps.flatMap(step => step.kind === 'agent' ? [step.preset] : []))]
                  const { Face } = handoffs.helpers
                  return (
                    <div key={definition.id} className={css.libraryRow} role="row">
                      <span role="cell" className={css.libraryName}>
                        <button type="button" className={css.libraryOpen} onClick={() => { open(definition) }}>{definition.name}</button>
                        <span className={css.kind} data-kind={definition.kind}>{t(`kind.${definition.kind}`)}</span>
                        {definition.description !== '' && <span className={css.libraryDesc}>{definition.description}</span>}
                      </span>
                      <span role="cell" className={css.faces}>
                        {crew.slice(0, 5).map((id) => {
                          const member = members.find(entry => entry.id === id)
                          const look = member?.design === undefined ? {} : { design: member.design }
                          return <span key={id} title={member?.name ?? id}><Face agentId={id} size={22} {...look} /></span>
                        })}
                        {crew.length === 0 && <span className={css.muted}>{t('library.tools')}</span>}
                      </span>
                      <span role="cell">
                        {last === undefined
                          ? <span className={css.muted}>{t(definition.draft === true ? 'draft' : 'noRuns')}</span>
                          : <span className={css.lastCell}><span className={css.status} data-status={last.status}><span className={css.dot} />{t(`run.status.${last.status}`)}</span><span className={css.muted}>{ago(last.startedAt)}</span></span>}
                      </span>
                      <span role="cell" className={css.squares} aria-label={t('library.historyLabel', { count: Math.min(history.length, 10) })}>
                        {history.slice(0, 10).toReversed().map(entry => (
                          <span key={entry.runId} className={css.square} data-status={entry.status} />
                        ))}
                      </span>
                      <span role="cell" className={css.mono}>{avg === undefined ? '—' : duration(avg)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
        {selected !== undefined && (
          <Editor key={editorKey} initial={selected} members={members} Face={handoffs.helpers.Face} t={t}
            onBack={() => { setSelected(undefined) }} {...runs.length > 0 ? { onHistory: showRuns } : {}}
            save={async (definition) => {
              const result = await save(definition)
              if ('saved' in result) { setSelected(result.saved); await refresh() }
              return result
            }}
            run={async (id) => {
              const refusal = await run(id)
              setRunId(undefined)
              await refresh()
              return refusal
            }}
            remove={async (id) => { if (await remove(id)) { setSelected(undefined); await refresh() } }} />
        )}
        {runs[0] !== undefined && (
          <div className={css.strip} aria-label={t('strip')}>
            <span className={css.status} data-status={runs[0].status}><span className={css.dot} />{t(`run.status.${runs[0].status}`)}</span>
            <span>{t('strip.last', { time: ago(runs[0].startedAt) })}</span>
            {runs[0].endedAt !== undefined && <span className={css.mono}>{t('run.took', { time: duration(runs[0].endedAt - runs[0].startedAt) })}</span>}
            <span className={css.grow} />
            <span className={css.stripBars} aria-hidden="true">
              {runs[0].steps.map(step => (
                <span key={step.id} className={css.stripBar} data-status={runs[0]?.progress.find(entry => entry.stepId === step.id)?.status ?? 'pending'} />
              ))}
            </span>
            <button type="button" className={css.linkButton} onClick={showRuns}>{t('strip.open')}</button>
          </div>
        )}
        {selected !== undefined && selected.id !== '' && (
          <section ref={runsRef} className={css.runs} aria-label={t('runs')}>
            <h2 className={css.heading}>{t('runs')}</h2>
            {runs.length === 0 && <p className={css.muted}>{t('noRuns')}</p>}
            {runs.length > 1 && (
              <div className={css.history}>
                {runs.map(entry => (
                  <button key={entry.runId} type="button" className={css.runChip} data-status={entry.status} aria-pressed={entry.runId === shown?.runId}
                    onClick={() => { setRunId(entry.runId) }}>
                    <span className={css.dot} />{t(`run.status.${entry.status}`)} · {new Date(entry.startedAt).toLocaleTimeString()}
                  </button>
                ))}
              </div>
            )}
            {shown !== undefined && <RunView run={shown} members={members} handoffs={handoffs} cancel={cancel} t={t} />}
          </section>
        )}
      </div>
    </main>
  )
}
