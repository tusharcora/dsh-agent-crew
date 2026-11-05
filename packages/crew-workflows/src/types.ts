/** Workflow definitions and runs, shared by the Host and the Workflows page. */
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

/**
 * `agentic` workflows hand work between crew members, each step's output passed to the next stage; `fixed` workflows
 * run a fixed list of tool calls with no model involved.
 */
export type WorkflowKind = 'agentic' | 'fixed'

/** A crew member doing one task. */
export interface AgentStep {
  readonly id: string
  readonly kind: 'agent'
  /** Crew preset id, such as `crew-research`. */
  readonly preset: string
  /** Short label shown on cards, such as "Find sources". */
  readonly task: string
  /** What the member is asked to do. */
  readonly prompt: string
  /** Run in the same stage as the step before it, at the same time. */
  readonly together?: boolean
}

/** One tool call with fixed input. */
export interface ToolStep {
  readonly id: string
  readonly kind: 'tool'
  readonly tool: string
  readonly input: { readonly [key: string]: JsonValue }
  readonly together?: boolean
}

/** One step. */
export type WorkflowStep = AgentStep | ToolStep

/** A saved workflow. `draft` marks one an agent proposed and the user has not yet saved. */
export interface WorkflowDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly kind: WorkflowKind
  /** Folder the workflow works in; the crew's own folder when omitted. */
  readonly cwd?: string
  readonly steps: readonly WorkflowStep[]
  readonly draft?: boolean
  /** ISO time of the last save. */
  readonly updatedAt: string
}

/** Lifecycle of one step in a run. */
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

/** One step's progress. */
export interface StepRun {
  readonly stepId: string
  readonly status: StepStatus
  /** Child Session of an agent step, once it starts. */
  readonly sessionId?: string
  readonly startedAt?: number
  readonly endedAt?: number
  /** The step's final text, cut to a readable length. */
  readonly output?: string
  readonly error?: string
}

/** One run of a workflow. */
export interface WorkflowRunRecord {
  readonly runId: string
  readonly workflowId: string
  readonly name: string
  readonly kind: WorkflowKind
  /** The lead Session that owns the run's steps. */
  readonly sessionId: string
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled'
  readonly startedAt: number
  readonly endedAt?: number
  /** The definition as it ran. */
  readonly steps: readonly WorkflowStep[]
  readonly progress: readonly StepRun[]
}

/** Everything the page shows. */
export interface WorkflowsState {
  readonly workflows: readonly WorkflowDefinition[]
  readonly runs: readonly WorkflowRunRecord[]
}

/** Outcome of a page action. */
export type WorkflowsResult<T = true> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string }
