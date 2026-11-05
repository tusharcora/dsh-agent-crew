/** The Workflows page: saved workflows on the left, the editor and that workflow's runs on the right. */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDefinition, WorkflowKind, WorkflowsState } from '@deepseek-ai/dsh-crew-workflows/types'
import { Editor, type EditorProps } from './Editor.tsx'
import { RunView, type HandoffsWithCopy, type Member } from './RunView.tsx'
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

function blank(kind: WorkflowKind): WorkflowDefinition {
  return { id: '', name: '', description: '', kind, steps: [], updatedAt: '' }
}

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
  const open = (definition: WorkflowDefinition) => { setSelected(definition); setEditorKey(key => key + 1); setRunId(undefined) }
  const runs = state?.runs.filter(entry => entry.workflowId === selected?.id).toReversed() ?? []
  const shown = runs.find(entry => entry.runId === runId) ?? runs[0]
  return (
    <main className={css.page}>
      <aside className={css.side} aria-label={t('list')}>
        <h1 className={css.title}>{t('title')}</h1>
        <p className={css.muted}>{t('intro')}</p>
        <div className={css.row}>
          <Button size="sm" variant="primary" onClick={() => { open(blank('agentic')) }}>{t('new.agentic')}</Button>
          <Button size="sm" variant="outline" onClick={() => { open(blank('fixed')) }}>{t('new.fixed')}</Button>
        </div>
        {failed && <p className={css.bad} role="alert">{t('failed')}</p>}
        {state !== undefined && state.workflows.length === 0 && <p className={css.muted}>{t('empty')}</p>}
        <ul className={css.list}>
          {state?.workflows.map(definition => (
            <li key={definition.id}>
              <button type="button" className={css.item} aria-current={definition.id === selected?.id || undefined} onClick={() => { open(definition) }}>
                <span className={css.itemName}>{definition.name}</span>
                <span className={css.muted}>
                  {t(`kind.${definition.kind}`)} · {t('steps.count', { count: definition.steps.length })}{definition.draft === true ? ` · ${t('draft')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className={css.main}>
        {selected !== undefined && (
          <Editor key={editorKey} initial={selected} members={members} t={t}
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
        {selected !== undefined && selected.id !== '' && (
          <section className={css.runs} aria-label={t('runs')}>
            <h2 className={css.heading}>{t('runs')}</h2>
            {runs.length === 0 && <p className={css.muted}>{t('noRuns')}</p>}
            {runs.length > 1 && (
              <div className={css.row}>
                {runs.map(entry => (
                  <button key={entry.runId} type="button" className={css.runChip} aria-pressed={entry.runId === shown?.runId}
                    onClick={() => { setRunId(entry.runId) }}>
                    {t(`run.status.${entry.status}`)} · {new Date(entry.startedAt).toLocaleTimeString()}
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
