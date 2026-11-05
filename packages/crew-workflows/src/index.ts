/**
 * Crew workflows, Host half: saved workflows, the runner that executes them under a lead Session, the Remote the
 * Workflows page uses, and the `crew_workflow_draft` tool that lets an agent propose a workflow for the user to save.
 * @module @deepseek-ai/dsh-crew-workflows
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-session-title'
import { runWorkflow, type RunnerDeps, type StepOutcome } from './runner.ts'
import type { WorkflowDefinition, WorkflowRunRecord, WorkflowsResult, WorkflowsState, WorkflowStep } from './types.ts'
import { problemsOf } from './validate.ts'

export type * from './types.ts'
export { promptFor, runWorkflow, type RunnerDeps, type StepOutcome } from './runner.ts'
export { CREW_PRESET, MAX_STEPS, problemsOf, stagesOf } from './validate.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Saved workflows and their runs. */
    crewWorkflows: CrewWorkflows
  }
}

/** Model-facing draft tool name. */
export const DRAFT_TOOL = 'crew_workflow_draft'

/** Plugin config. */
export interface Config {
  /** Folder holding `workflows.json`; runs without a folder of their own work in `workflows/` under it. */
  homeDirectory: string
  /** Subagent provider agent steps start on. */
  provider: string
  /** Finished runs kept for the page. */
  keepRuns: number
}

/** Config schema. */
export const Config: z<Config> = z.object({
  homeDirectory: z.string().required().description('Folder holding workflows.json.'),
  provider: z.string().default('spawn').description('Subagent provider for agent steps.'),
  keepRuns: z.number().min(1).max(200).default(30).description('Finished runs kept for the page.'),
})

interface StoreFile {
  readonly version: 1
  readonly workflows: readonly WorkflowDefinition[]
  readonly runs: readonly WorkflowRunRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read a drafted step from tool arguments.
 * @param value - one `steps[]` entry.
 * @param index - its position, for a fallback id.
 * @returns the step, or undefined when it is malformed.
 */
export function asStep(value: unknown, index: number): WorkflowStep | undefined {
  if (!isRecord(value)) return undefined
  const id = `step-${String(index + 1)}`
  const together = value['together'] === true ? { together: true } : {}
  if (value['kind'] === 'tool' && typeof value['tool'] === 'string') {
    const input = isRecord(value['input']) ? value['input'] as { [key: string]: JsonValue } : {}
    return { id, kind: 'tool', tool: value['tool'], input, ...together }
  }
  const { preset, task, prompt } = value
  if (typeof preset !== 'string' || typeof task !== 'string' || typeof prompt !== 'string') return undefined
  return { id, kind: 'agent', preset, task, prompt, ...together }
}

/** Saved workflows, runs, and the page's Remote. */
export class CrewWorkflows extends TypertRemoteService {
  static inject = ['tools', 'subagents', 'sessionController']
  static Config = Config
  private file: StoreFile = { version: 1, workflows: [], runs: [] }
  private loaded: Promise<void> | undefined
  private writes: Promise<unknown> = Promise.resolve()
  private readonly live = new Map<string, AbortController>()

  /**
   * @param ctx - owning plugin context.
   * @param config - plugin config.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewWorkflows')
  }

  protected async [Service.init](): Promise<void> {
    await this.load()
    this.ctx.effect(() => async () => {
      for (const controller of this.live.values()) controller.abort()
      await this.writes
    }, 'crew-workflows.runs')
    this.ctx.effect(() => this.ctx.tools.register(defineTool({
      name: DRAFT_TOOL,
      description: 'Propose a crew workflow the user can review, edit, save and run from the Workflows page. Nothing runs until the user '
        + 'clicks Run. Use it when the user asks you to set up a repeatable workflow. An agentic workflow hands work between crew '
        + 'members (presets crew-chief, crew-mail, crew-chat, crew-code, crew-research, crew-life); a fixed workflow runs tool calls only.',
      parameters: {
        name: { type: 'string', required: true, description: 'Short workflow name.' },
        description: { type: 'string', required: true, description: 'One sentence on what the workflow does.' },
        kind: { type: 'string', required: true, enum: ['agentic', 'fixed'] as const, description: 'agentic or fixed.' },
        steps: {
          type: 'array', required: true,
          description: 'Steps in order. Agent step: { kind: "agent", preset, task, prompt }. Tool step: { kind: "tool", tool, input }. '
            + 'Set together: true to run a step at the same time as the step before it.',
          items: { type: 'object', additionalProperties: true, properties: {} },
        },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', required: true }, problems: { type: 'array', required: true, items: { type: 'string' } } } },
        render: (_args, value) => [{
          type: 'text',
          text: value.problems.length === 0
            ? `Saved draft ${value.id}. Tell the user to review it on the Workflows page and click Run when it looks right.`
            : `Saved draft ${value.id} with problems the user must fix before it can run: ${value.problems.join(' ')}`,
        }],
      },
      execute: async (args) => {
        const steps = (args.steps as unknown[]).flatMap((entry, index) => asStep(entry, index) ?? [])
        const draft: WorkflowDefinition = {
          id: `wf-${randomUUID().slice(0, 8)}`, name: args.name, description: args.description, kind: args.kind,
          steps, draft: true, updatedAt: new Date().toISOString(),
        }
        await this.change(file => ({ ...file, workflows: [...file.workflows, draft] }))
        return { id: draft.id, problems: [...problemsOf(draft, this.toolNames())] }
      },
    })), 'crew-workflows.draft-tool')
  }

  private get path(): string {
    return join(this.config.homeDirectory, 'workflows.json')
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
        if (isRecord(parsed) && Array.isArray(parsed['workflows']) && Array.isArray(parsed['runs'])) {
          // Runs that were live when dsh stopped did not finish; mark them so the page does not wait on them.
          const runs = (parsed['runs'] as WorkflowRunRecord[]).map(run => run.status === 'running' ? { ...run, status: 'cancelled' as const } : run)
          this.file = { version: 1, workflows: parsed['workflows'] as WorkflowDefinition[], runs }
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.ctx.logger.warn(`crew-workflows: ${this.path} unreadable: ${String(error)}`)
      }
    })()
    return this.loaded
  }

  /** Apply one change to a copy, save it, then publish it; a failed save changes nothing. */
  private change(mutate: (file: StoreFile) => StoreFile): Promise<void> {
    const result = this.writes.then(async () => {
      await this.load()
      const next = mutate(this.file)
      await writeFileAtomic(this.path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
      this.file = next
    })
    this.writes = result.catch(() => undefined)
    return result
  }

  private toolNames(): ReadonlySet<string> {
    return new Set(this.ctx.tools.schemas().map(schema => schema.name))
  }

  /**
   * Saved workflows and recent runs.
   * @returns the page state.
   */
  @Remote('state')
  async state(): Promise<WorkflowsState> {
    await this.load()
    return { workflows: this.file.workflows, runs: this.file.runs }
  }

  /**
   * Save a workflow, replacing one with the same id; saving clears its draft mark.
   * @param definition - the workflow.
   * @returns the saved workflow, or why it cannot be saved.
   */
  @Remote('save')
  async save(definition: WorkflowDefinition): Promise<WorkflowsResult<WorkflowDefinition>> {
    const problems = problemsOf(definition, this.toolNames())
    if (problems.length > 0) return { ok: false, message: problems.join(' ') }
    const { draft: _draft, ...rest } = definition
    const saved: WorkflowDefinition = { ...rest, id: definition.id === '' ? `wf-${randomUUID().slice(0, 8)}` : definition.id, updatedAt: new Date().toISOString() }
    await this.change(file => ({ ...file, workflows: [...file.workflows.filter(entry => entry.id !== saved.id), saved] }))
    return { ok: true, value: saved }
  }

  /**
   * Delete a saved workflow; its past runs stay listed.
   * @param id - workflow id.
   * @returns success.
   */
  @Remote('remove')
  async remove(id: string): Promise<WorkflowsResult> {
    await this.change(file => ({ ...file, workflows: file.workflows.filter(entry => entry.id !== id) }))
    return { ok: true, value: true }
  }

  /**
   * Start a saved workflow. It runs in the background; the page follows it through `state`.
   * @param id - workflow id.
   * @returns the new run id, or why it cannot run.
   */
  @Remote('run')
  async run(id: string): Promise<WorkflowsResult<string>> {
    await this.load()
    const definition = this.file.workflows.find(entry => entry.id === id)
    if (definition === undefined) return { ok: false, message: 'That workflow no longer exists.' }
    if (definition.draft === true) return { ok: false, message: 'Save the draft before running it.' }
    const problems = problemsOf(definition, this.toolNames())
    if (problems.length > 0) return { ok: false, message: problems.join(' ') }
    const runId = `run-${randomUUID().slice(0, 8)}`
    const controller = new AbortController()
    this.live.set(runId, controller)
    const publish = (record: WorkflowRunRecord) => {
      void this.change((file) => {
        const others = file.runs.filter(run => run.runId !== record.runId)
        const finished = others.filter(run => run.status !== 'running').slice(-(this.config.keepRuns - 1))
        return { ...file, runs: [...others.filter(run => run.status === 'running'), ...finished, record] }
      }).catch((error: unknown) => { this.ctx.logger.warn(`crew-workflows: run ${runId} not saved: ${String(error)}`) })
    }
    void runWorkflow(definition, runId, this.deps(), publish, controller.signal).finally(() => { this.live.delete(runId) })
    return { ok: true, value: runId }
  }

  /**
   * Cancel a running workflow; steps already running are stopped.
   * @param runId - run id.
   * @returns success, or that the run is not running.
   */
  @Remote('cancel')
  cancel(runId: string): Promise<WorkflowsResult> {
    const controller = this.live.get(runId)
    if (controller === undefined) return Promise.resolve({ ok: false, message: 'That run is not running.' })
    controller.abort()
    return Promise.resolve({ ok: true, value: true })
  }

  private deps(): RunnerDeps<Agent> {
    const ctx = this.ctx
    return {
      now: () => Date.now(),
      createLead: async (definition) => {
        const sessionId = SessionId(`session-${randomUUID()}`)
        await ctx.sessionController.create({
          sessionId, cwd: definition.cwd ?? join(this.config.homeDirectory, 'workflows'),
          ...definition.kind === 'agentic' ? { agentPreset: 'crew-chief' } : {},
        })
        const resolved = await ctx.sessionController.resolveAgent(sessionId)
        if ('error' in resolved) throw resolved.error
        try { ctx.get('sessionTitle')?.rename(resolved.agent.session, `Workflow: ${definition.name}`) } catch (_error: unknown) {
          // A title is cosmetic; the run continues untitled.
        }
        return { lead: resolved.agent, sessionId }
      },
      startAgent: async (lead, step, prompt, signal) => {
        const activation = await ctx.subagents.startActivation({
          provider: this.config.provider, label: step.task, prompt: [{ type: 'text', text: prompt }], parent: lead,
          agentPreset: step.preset, delivery: 'caller', signal,
        })
        const outcome = activation.result.then((result): StepOutcome => {
          const text = result.output.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
          return result.stopReason === 'completed'
            ? { ok: true, text }
            : { ok: false, text: result.diagnostic ?? `The crew member stopped: ${result.stopReason}` }
        })
        return { sessionId: activation.childId, outcome }
      },
      runTool: async (lead, step, signal) => {
        const callId = ToolCallId(`wf-${randomUUID().slice(0, 12)}`)
        const batch = await ctx.tools.execute({
          agent: lead, signal, calls: [{ type: 'tool-call', id: callId, name: step.tool, arguments: JSON.stringify(step.input) }],
        })
        const result = batch.results[0]?.result
        if (result === undefined) return { ok: false, text: 'The tool returned nothing.' }
        const text = result.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
        return { ok: !result.isError, text }
      },
    }
  }
}

export default CrewWorkflows
