/** Run one workflow: stages in order, the steps of a stage at the same time, each stage's results handed to the next. */
import type { AgentStep, StepRun, ToolStep, WorkflowDefinition, WorkflowRunRecord } from './types.ts'
import { stagesOf } from './validate.ts'

/** Outcome of one step. */
export interface StepOutcome {
  readonly ok: boolean
  readonly text: string
}

/** What the runner asks the Host to do; tests pass fakes. */
export interface RunnerDeps<Lead> {
  /** Create the lead Session that owns the run. */
  readonly createLead: (definition: WorkflowDefinition, signal: AbortSignal) => Promise<{ readonly lead: Lead; readonly sessionId: string }>
  /** Start a crew member under the lead; resolves once it started, with its final outcome to await. */
  readonly startAgent: (
    lead: Lead, step: AgentStep, prompt: string, signal: AbortSignal,
  ) => Promise<{ readonly sessionId: string; readonly outcome: Promise<StepOutcome> }>
  /** Run one tool call as the lead, through the ordinary tool pipeline. */
  readonly runTool: (lead: Lead, step: ToolStep, signal: AbortSignal) => Promise<StepOutcome>
  readonly now: () => number
}

const MAX_OUTPUT = 4000
const MAX_HANDOFF = 12_000

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * The prompt an agent step receives: its own instructions, then what earlier stages produced.
 * @param step - the step.
 * @param earlier - outputs of finished steps, labelled by task.
 * @returns the full prompt.
 */
export function promptFor(step: AgentStep, earlier: readonly { readonly task: string; readonly text: string }[]): string {
  if (earlier.length === 0) return step.prompt
  const handed = earlier.map(entry => `## ${entry.task}\n${entry.text}`).join('\n\n')
  return `${step.prompt}\n\n# Results from earlier steps\n\n${cut(handed, MAX_HANDOFF)}`
}

function label(step: AgentStep | ToolStep): string {
  return step.kind === 'agent' ? step.task : step.tool
}

/**
 * Run a workflow to its end, publishing every change.
 * @param definition - the workflow to run.
 * @param runId - identity of this run.
 * @param deps - Host operations.
 * @param publish - receives each new run record.
 * @param signal - cancels the run.
 * @returns the final record.
 */
export async function runWorkflow<Lead>(
  definition: WorkflowDefinition,
  runId: string,
  deps: RunnerDeps<Lead>,
  publish: (run: WorkflowRunRecord) => void,
  signal: AbortSignal,
): Promise<WorkflowRunRecord> {
  const progress = new Map<string, StepRun>(definition.steps.map(step => [step.id, { stepId: step.id, status: 'pending' }]))
  let record: WorkflowRunRecord = {
    runId, workflowId: definition.id, name: definition.name, kind: definition.kind, sessionId: '', status: 'running',
    startedAt: deps.now(), steps: definition.steps, progress: [...progress.values()],
  }
  const update = (patch: Partial<WorkflowRunRecord>, step?: StepRun) => {
    if (step !== undefined) progress.set(step.stepId, step)
    record = { ...record, ...patch, progress: definition.steps.map(entry => progress.get(entry.id) ?? { stepId: entry.id, status: 'pending' }) }
    publish(record)
  }
  const finish = (status: WorkflowRunRecord['status']) => {
    for (const entry of progress.values()) {
      if (entry.status === 'pending') progress.set(entry.stepId, { ...entry, status: 'skipped' })
    }
    update({ status, endedAt: deps.now() })
    return record
  }
  let lead: Lead
  try {
    const created = await deps.createLead(definition, signal)
    lead = created.lead
    update({ sessionId: created.sessionId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const first = definition.steps[0]
    if (first !== undefined) update({}, { stepId: first.id, status: 'failed', error: `The run could not start: ${message}` })
    return finish('failed')
  }
  const earlier: { task: string; text: string }[] = []
  for (const stage of stagesOf(definition.steps)) {
    if (signal.aborted) return finish('cancelled')
    const outcomes = await Promise.all(stage.map(async (step): Promise<StepOutcome> => {
      const startedAt = deps.now()
      update({}, { stepId: step.id, status: 'running', startedAt })
      try {
        let sessionId: string | undefined
        let outcome: StepOutcome
        if (step.kind === 'agent') {
          const started = await deps.startAgent(lead, step, promptFor(step, earlier), signal)
          sessionId = started.sessionId
          update({}, { stepId: step.id, status: 'running', startedAt, sessionId })
          outcome = await started.outcome
        } else {
          outcome = await deps.runTool(lead, step, signal)
        }
        update({}, {
          stepId: step.id, status: outcome.ok ? 'done' : 'failed', startedAt, endedAt: deps.now(),
          ...sessionId === undefined ? {} : { sessionId },
          ...outcome.ok ? { output: cut(outcome.text, MAX_OUTPUT) } : { error: cut(outcome.text, MAX_OUTPUT) },
        })
        return outcome
      } catch (error: unknown) {
        const text = error instanceof Error ? error.message : String(error)
        update({}, { stepId: step.id, status: 'failed', startedAt, endedAt: deps.now(), error: text })
        return { ok: false, text }
      }
    }))
    // Re-read: the stage awaited, so the signal may have fired meanwhile.
    if (isAborted(signal)) return finish('cancelled')
    // A failed stage stops the run; later stages would build on missing results.
    if (outcomes.some(outcome => !outcome.ok)) return finish('failed')
    stage.forEach((step, index) => { earlier.push({ task: label(step), text: outcomes[index]?.text ?? '' }) })
  }
  return finish('completed')
}

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted
}
