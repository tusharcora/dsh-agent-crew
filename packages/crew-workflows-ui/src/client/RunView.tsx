/**
 * One run: its status, progress and elapsed time, a timeline with a bar per step on one time axis, and the handoffs
 * between the crew members it used.
 */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { CrewHandoffs, HandoffViewData, HandoffViewProps } from '@deepseek-ai/dsh-crew-handoff-ui/client'
import type { WorkflowRunRecord } from '@deepseek-ai/dsh-crew-workflows/types'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** A crew member as the editor and run view show it. */
export interface Member {
  readonly id: string
  readonly name: string
  /** Designed face, when the roster has one. */
  readonly design?: CrewFaceProps['design']
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

/**
 * Length of a span as "1h 2m", "3m 4s" or "5s".
 * @param ms - milliseconds.
 * @returns the short form.
 */
export function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${String(h)}h ${String(m)}m` : m > 0 ? `${String(m)}m ${String(s)}s` : `${String(s)}s`
}

/**
 * How long ago a time was, in the largest whole unit.
 * @param time - epoch milliseconds.
 * @param now - the current time.
 * @returns e.g. "5 min. ago".
 */
export function ago(time: number, now = Date.now()): string {
  const minutes = Math.round((time - now) / 60_000)
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'narrow' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  if (Math.abs(minutes) < 60 * 24) return format.format(Math.round(minutes / 60), 'hour')
  return format.format(Math.round(minutes / (60 * 24)), 'day')
}

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

/** The current time, ticking each second while `live`. */
function useClock(live: boolean): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [live])
  return now
}

/**
 * Render one run.
 * @param props - the run, crew names, the shared handoff view, cancel and copy.
 * @returns the run view.
 */
export function RunView({ run, members, handoffs, cancel, t }: RunViewProps) {
  const { View, helpers } = handoffs
  const { Face } = helpers
  const live = run.status === 'running'
  const now = useClock(live)
  const leadId = run.sessionId === '' ? undefined : SessionId(run.sessionId)
  const done = run.progress.filter(entry => entry.status === 'done').length
  const total = run.steps.length
  const elapsed = (run.endedAt ?? now) - run.startedAt
  const ends = run.progress.flatMap(entry => entry.startedAt === undefined ? [] : [entry.endedAt ?? (entry.status === 'running' ? now : entry.startedAt)])
  // The axis covers the run so far, at least one second, so bars never divide by zero.
  const span = Math.max(elapsed, ...ends.map(end => end - run.startedAt), 1000)
  const lastEnd = ends.length === 0 ? 0 : (Math.max(...ends) - run.startedAt) / span
  return (
    <section className={css.run} aria-label={run.name}>
      <div className={css.runHead}>
        <span className={css.status} data-status={run.status}><span className={css.dot} />{t(`run.status.${run.status}`)}</span>
        <span className={css.muted}>{t('run.started', { time: new Date(run.startedAt).toLocaleString() })}</span>
        <span className={css.muted}>{t(live ? 'run.elapsed' : 'run.took', { time: duration(elapsed) })}</span>
        <span className={css.grow} />
        {leadId !== undefined && <Button size="sm" variant="outline" onClick={() => { helpers.open(leadId) }}>{t('run.open')}</Button>}
        {live && <Button size="sm" variant="outline" onClick={() => { cancel(run.runId) }}>{t('run.cancel')}</Button>}
      </div>
      <div className={css.progress} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
        aria-label={t('run.progress', { done, total })}>
        <i style={{ width: `${String(total === 0 ? 0 : (done / total) * 100)}%` }} data-status={run.status} />
      </div>
      <p className={css.muted}>{t('run.progress', { done, total })}</p>
      <div className={css.axis} aria-hidden="true">
        <span />
        <span className={css.ticks}>{[0, 1, 2, 3, 4].map(i => <span key={i}>{duration((span * i) / 4)}</span>)}</span>
      </div>
      <ol className={css.timeline} aria-label={t('board')}>
        {run.steps.map((step, index) => {
          const progress = run.progress.find(entry => entry.stepId === step.id)
          const status = progress?.status ?? 'pending'
          const member = step.kind === 'agent' ? members.find(entry => entry.id === step.preset) : undefined
          const label = step.kind === 'agent' ? `${step.task} · ${member?.name ?? step.preset}` : step.tool
          const from = progress?.startedAt
          const to = from === undefined ? undefined : (progress?.endedAt ?? (status === 'running' ? now : from))
          // A step that has not started sits just after everything that has, drawn as an outline.
          const left = from === undefined ? Math.min(lastEnd, 0.92) : (from - run.startedAt) / span
          const width = from === undefined || to === undefined ? 0.08 : Math.max((to - from) / span, 0.01)
          return (
            <li key={step.id} className={css.lane} data-status={status}>
              <span className={css.laneLabel}>
                <span className={css.laneIndex}>{index + 1}</span>
                {member !== undefined && Face !== undefined
                  ? <Face agentId={member.id} size={18} {...member.design === undefined ? {} : { design: member.design }} />
                  : <span className={css.tile} data-kind={step.kind} aria-hidden="true">{step.kind === 'agent' ? (member?.name ?? '?').slice(0, 1) : '{}'}</span>}
                <span className={css.laneName}>{label}</span>
              </span>
              <span className={css.track}>
                <span className={css.bar} data-status={status} style={{ left: `${String(left * 100)}%`, width: `${String(width * 100)}%` }} />
              </span>
              <span className={css.stageState}>
                {t(`col.${status}`)}{from !== undefined && to !== undefined && status !== 'pending' ? ` · ${duration(to - from)}` : ''}
              </span>
              {(progress?.output !== undefined || progress?.error !== undefined) && (
                <div className={css.laneDetail}>
                  {progress.output !== undefined && <details className={css.output}><summary>{t('output')}</summary><pre className={css.pre}>{progress.output}</pre></details>}
                  {progress.error !== undefined && <p className={css.bad}>{progress.error}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {run.kind === 'agentic' && (
        <div className={css.embed}><View data={handoffData(run)} {...helpers} t={handoffs.t} /></div>
      )}
    </section>
  )
}
