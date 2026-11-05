/** Check a workflow definition before it is saved or run. */
import type { WorkflowDefinition, WorkflowStep } from './types.ts'

/** Crew presets an agent step may name. */
export const CREW_PRESET = /^crew-[a-z]+$/

/** Most steps one workflow may have. */
export const MAX_STEPS = 24

const MAX_TEXT = 20_000

/**
 * Problems with a definition, in the words the editor shows.
 * @param definition - candidate definition.
 * @param tools - names of tools the Host has, for tool steps.
 * @returns problems; empty when it can be saved and run.
 */
export function problemsOf(definition: WorkflowDefinition, tools: ReadonlySet<string>): readonly string[] {
  const problems: string[] = []
  if (definition.name.trim() === '') problems.push('Give the workflow a name.')
  if (definition.steps.length === 0) problems.push('Add at least one step.')
  if (definition.steps.length > MAX_STEPS) problems.push(`A workflow can have at most ${String(MAX_STEPS)} steps.`)
  if (definition.steps[0]?.together === true) problems.push('The first step cannot run together with a step before it.')
  const ids = new Set<string>()
  definition.steps.forEach((step: WorkflowStep, index) => {
    const at = `Step ${String(index + 1)}`
    if (ids.has(step.id)) problems.push(`${at} repeats the id ${step.id}.`)
    ids.add(step.id)
    if (step.kind === 'agent') {
      if (definition.kind === 'fixed') problems.push(`${at}: a fixed workflow runs tools only, with no agent steps.`)
      if (!CREW_PRESET.test(step.preset)) problems.push(`${at}: choose a crew member.`)
      if (step.task.trim() === '') problems.push(`${at}: name the task.`)
      if (step.prompt.trim() === '') problems.push(`${at}: say what the crew member should do.`)
      if (step.prompt.length > MAX_TEXT) problems.push(`${at}: the instructions are too long.`)
    } else if (!tools.has(step.tool)) {
      problems.push(`${at}: there is no tool named ${step.tool}.`)
    }
  })
  return problems
}

/**
 * Split steps into stages: a step with `together` joins the stage of the step before it.
 * @param steps - steps in order.
 * @returns stages in order.
 */
export function stagesOf<S extends { readonly together?: boolean }>(steps: readonly S[]): readonly (readonly S[])[] {
  const stages: S[][] = []
  for (const step of steps) {
    const last = stages.at(-1)
    if (step.together === true && last !== undefined) last.push(step)
    else stages.push([step])
  }
  return stages
}
