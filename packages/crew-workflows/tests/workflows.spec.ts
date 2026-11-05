import { describe, expect, it } from 'vitest'
import { promptFor, runWorkflow, type RunnerDeps, type StepOutcome } from '../src/runner.ts'
import { problemsOf, stagesOf } from '../src/validate.ts'
import type { AgentStep, WorkflowDefinition, WorkflowRunRecord } from '../src/types.ts'

const agent = (id: string, extra: Partial<AgentStep> = {}): AgentStep =>
  ({ id, kind: 'agent', preset: 'crew-research', task: `task ${id}`, prompt: `do ${id}`, ...extra })
const definition = (steps: WorkflowDefinition['steps'], kind: WorkflowDefinition['kind'] = 'agentic'): WorkflowDefinition =>
  ({ id: 'wf-1', name: 'Morning', description: '', kind, steps, updatedAt: '' })

describe('problemsOf', () => {
  const tools = new Set(['web_fetch'])
  it('accepts a valid agentic workflow', () => {
    expect(problemsOf(definition([agent('a'), { id: 't', kind: 'tool', tool: 'web_fetch', input: {} }]), tools)).toEqual([])
  })
  it('rejects agent steps in a fixed workflow, unknown tools, a leading together and repeated ids', () => {
    const problems = problemsOf(definition([agent('a', { together: true }), agent('a'), { id: 't', kind: 'tool', tool: 'nope', input: {} }], 'fixed'), tools)
    expect(problems.join('\n')).toMatch(/first step cannot run together/)
    expect(problems.join('\n')).toMatch(/fixed workflow runs tools only/)
    expect(problems.join('\n')).toMatch(/repeats the id a/)
    expect(problems.join('\n')).toMatch(/no tool named nope/)
  })
  it('rejects a non-crew preset and an empty name', () => {
    const problems = problemsOf({ ...definition([agent('a', { preset: 'default' })]), name: ' ' }, tools)
    expect(problems).toContain('Give the workflow a name.')
    expect(problems).toContain('Step 1: choose a crew member.')
  })
})

describe('stagesOf', () => {
  it('groups together steps with the step before', () => {
    const stages = stagesOf([agent('a'), agent('b', { together: true }), agent('c'), agent('d', { together: true })])
    expect(stages.map(stage => stage.map(step => step.id))).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('promptFor', () => {
  it('passes earlier results under a heading', () => {
    expect(promptFor(agent('a'), [])).toBe('do a')
    expect(promptFor(agent('b'), [{ task: 'task a', text: 'found X' }])).toBe('do b\n\n# Results from earlier steps\n\n## task a\nfound X')
  })
})

function fakeDeps(results: Record<string, StepOutcome | Error>, prompts: string[] = []): RunnerDeps<string> {
  let clock = 0
  return {
    createLead: () => Promise.resolve({ lead: 'lead', sessionId: 's-lead' }),
    startAgent: (_lead, step, prompt) => {
      prompts.push(prompt)
      const value = results[step.id] ?? { ok: true, text: `${step.id} done` }
      return Promise.resolve({ sessionId: `s-${step.id}`, outcome: value instanceof Error ? Promise.reject(value) : Promise.resolve(value) })
    },
    runTool: (_lead, step) => {
      const value = results[step.id] ?? { ok: true, text: `${step.id} ran` }
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value)
    },
    now: () => ++clock,
  }
}

describe('runWorkflow', () => {
  it('runs stages in order and hands each stage the results before it', async () => {
    const prompts: string[] = []
    const published: WorkflowRunRecord[] = []
    const steps = [agent('a'), agent('b', { together: true }), agent('c')]
    const done = await runWorkflow(definition(steps), 'run-1', fakeDeps({}, prompts), (run) => { published.push(run) }, new AbortController().signal)
    expect(done.status).toBe('completed')
    expect(done.sessionId).toBe('s-lead')
    expect(done.progress.map(entry => [entry.stepId, entry.status, entry.sessionId])).toEqual([['a', 'done', 's-a'], ['b', 'done', 's-b'], ['c', 'done', 's-c']])
    expect(prompts[0]).toBe('do a')
    expect(prompts[2]).toContain('## task a\na done')
    expect(prompts[2]).toContain('## task b\nb done')
    expect(published.at(-1)).toEqual(done)
  })

  it('marks the run failed and skips later steps when a step fails or throws', async () => {
    const failed = await runWorkflow(definition([agent('a'), agent('b')]), 'run-2', fakeDeps({ a: { ok: false, text: 'no access' } }), () => {}, new AbortController().signal)
    expect(failed.status).toBe('failed')
    expect(failed.progress.map(entry => entry.status)).toEqual(['failed', 'skipped'])
    const thrown = await runWorkflow(definition([{ id: 't', kind: 'tool', tool: 'x', input: {} }], 'fixed'), 'run-3', fakeDeps({ t: new Error('boom') }), () => {}, new AbortController().signal)
    expect(thrown.status).toBe('failed')
    expect(thrown.progress[0]?.error).toBe('boom')
  })

  it('stops as cancelled when aborted', async () => {
    const controller = new AbortController()
    const deps = fakeDeps({})
    const run = runWorkflow(definition([agent('a'), agent('b')]), 'run-4', {
      ...deps,
      startAgent: async (lead, step, prompt, signal) => { controller.abort(); return deps.startAgent(lead, step, prompt, signal) },
    }, () => {}, controller.signal)
    const done = await run
    expect(done.status).toBe('cancelled')
    expect(done.progress[1]?.status).not.toBe('done')
  })
})
