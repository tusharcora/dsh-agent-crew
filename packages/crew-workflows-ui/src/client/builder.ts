/**
 * Builder layout: steps grouped into rows that run one after another, the steps in a row running together.
 * A step's `together` flag says it runs alongside the step before, so a row is a step without the flag plus the
 * flagged steps after it.
 */
import type { WorkflowStep } from '@deepseek-ai/dsh-crew-workflows/types'

/** Where a dragged card lands: a new row before row `row` (`rows.length` appends), or the end of row `row`. */
export type DropTarget = { readonly kind: 'row'; readonly row: number } | { readonly kind: 'join'; readonly row: number }

/**
 * Group steps into rows.
 * @param steps - steps in run order.
 * @returns rows, each holding at least one step.
 */
export function rowsOf(steps: readonly WorkflowStep[]): WorkflowStep[][] {
  const rows: WorkflowStep[][] = []
  for (const step of steps) {
    const last = rows.at(-1)
    if (step.together === true && last !== undefined) last.push(step)
    else rows.push([step])
  }
  return rows
}

function flag(step: WorkflowStep, together: boolean): WorkflowStep {
  const { together: _old, ...rest } = step
  return together ? { ...rest, together: true } as WorkflowStep : rest as WorkflowStep
}

/**
 * Flatten rows back into steps, setting `together` from the layout.
 * @param rows - rows in run order.
 * @returns steps in run order.
 */
export function flatten(rows: readonly (readonly WorkflowStep[])[]): WorkflowStep[] {
  return rows.flatMap(row => row.map((step, index) => flag(step, index > 0)))
}

/**
 * Put a step at a drop target, moving it when it is already in the list.
 * @param steps - steps in run order.
 * @param step - the step to place; an existing step is matched by id.
 * @param target - where it lands, counted in the rows before the step was taken out.
 * @returns the new steps.
 */
export function place(steps: readonly WorkflowStep[], step: WorkflowStep, target: DropTarget): WorkflowStep[] {
  const rows = rowsOf(steps)
  // Leave an empty row in place while removing, so target row numbers still count the original rows.
  const without = rows.map(row => row.filter(entry => entry.id !== step.id))
  const placed = without.map(row => [...row])
  const at = Math.max(0, Math.min(target.row, placed.length))
  if (target.kind === 'join' && placed[at] !== undefined) placed[at].push(step)
  else placed.splice(at, 0, [step])
  return flatten(placed.filter(row => row.length > 0))
}
