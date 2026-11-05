/** One run: its status, a column per step state, and the handoffs between the crew members it used. */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewHandoffs, HandoffViewData, HandoffViewProps } from '@deepseek-ai/dsh-crew-handoff-ui/client'
import type { StepStatus, WorkflowRunRecord } from '@deepseek-ai/dsh-crew-workflows/types'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** A crew member as the editor and run view show it. */
export interface Member {
  readonly id: string
  readonly name: string
}

/** The shared handoff view with its own copy, as the page receives it. */
export type HandoffsWithCopy = CrewHandoffs & { readonly t: HandoffViewProps['t'] }

/** Props of {@link RunView}. */
export interface RunViewProps {
  readonly run: WorkflowRunRecord
  readonly members: readonly Member[]
  readonly handoffs: HandoffsWithCopy
  readonly cancel: (runId: string) => void
  readonly t: TranslateNS<'crewWorkflows'>
}

const COLUMNS: readonly StepStatus[] = ['pending', 'running', 'done', 'failed', 'skipped']

/**
 * The run as Handoffs view data: the lead and one card per agent step.
 * @param run - the run.
 * @returns cards and lanes.
 */
export function handoffData(run: WorkflowRunRecord): HandoffViewData {
  const lead = { sessionId: SessionId(run.sessionId || run.runId), name: 'lead', preset: 'crew-chief', handoffs: 0, state: run.status === 'running' ? 'working' as const : 'idle' as const }
  const agents = run.steps.flatMap((step) => {
    if (step.kind !== 'agent') return []
    const progress = run.progress.find(entry => entry.stepId === step.id)
    if (progress?.sessionId === undefined) return []
    return [{
      card: { sessionId: SessionId(progress.sessionId), name: step.task, preset: step.preset, handoffs: 1, task: step.task, state: progress.status === 'running' ? 'working' as const : 'idle' as const },
      item: { callId: step.id, child: step.task, task: step.task, brief: step.prompt.split('\n')[0] ?? '', tool: 'workflow', time: progress.startedAt ?? run.startedAt },
    }]
  })
  return {
    lead: { ...lead, handoffs: agents.length },
    agents: agents.map(entry => entry.card),
    lanes: agents.map(entry => ({ to: entry.card, items: [entry.item] })),
  }
}

/**
 * Render one run.
 * @param props - the run, crew names, the shared handoff view, cancel and copy.
 * @returns the run view.
 */
export function RunView({ run, members, handoffs, cancel, t }: RunViewProps) {
  const { View, helpers } = handoffs
  const labelOf = (stepId: string): string => {
    const step = run.steps.find(entry => entry.id === stepId)
    if (step === undefined) return stepId
    return step.kind === 'agent' ? `${step.task} · ${members.find(member => member.id === step.preset)?.name ?? step.preset}` : step.tool
  }
  const leadId = run.sessionId === '' ? undefined : SessionId(run.sessionId)
  return (
    <section className={css.run} aria-label={run.name}>
      <div className={css.runHead}>
        <span className={css.status} data-status={run.status}>{t(`run.status.${run.status}`)}</span>
        <span className={css.muted}>{t('run.started', { time: new Date(run.startedAt).toLocaleString() })}</span>
        <span className={css.grow} />
        {leadId !== undefined && <Button size="sm" variant="outline" onClick={() => { helpers.open(leadId) }}>{t('run.open')}</Button>}
        {run.status === 'running' && <Button size="sm" variant="outline" onClick={() => { cancel(run.runId) }}>{t('run.cancel')}</Button>}
      </div>
      <h4 className={css.sub}>{t('board')}</h4>
      <div className={css.columns}>
        {COLUMNS.map((column) => {
          const steps = run.progress.filter(entry => entry.status === column)
          if (steps.length === 0 && (column === 'skipped' || column === 'failed')) return null
          return (
            <section key={column} className={css.column} aria-label={t('column.label', { column: t(`col.${column}`), count: steps.length })}>
              <h5 className={css.columnHead} data-status={column}>{t(`col.${column}`)} <span className={css.muted}>{steps.length}</span></h5>
              <ul className={css.cards}>
                {steps.map(entry => (
                  <li key={entry.stepId} className={css.card}>
                    <span className={css.cardTitle}>{labelOf(entry.stepId)}</span>
                    {entry.output !== undefined && <details><summary>{t('output')}</summary><pre className={css.pre}>{entry.output}</pre></details>}
                    {entry.error !== undefined && <p className={css.bad}>{entry.error}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {run.kind === 'agentic' && (
        <>
          <h4 className={css.sub}>{t('handoffs')}</h4>
          <div className={css.embed}><View data={handoffData(run)} {...helpers} t={handoffs.t} /></div>
        </>
      )}
    </section>
  )
}
