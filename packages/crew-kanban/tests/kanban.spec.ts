import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CrewKanban, { columnOf, moveAction, targetsFrom } from '../src/index.ts'

describe('columns', () => {
  it('places tasks by status and readiness', () => {
    expect(columnOf({ status: 'pending', ready: false })).toBe('blocked')
    expect(columnOf({ status: 'pending', ready: true })).toBe('todo')
    expect(columnOf({ status: 'in_progress', ready: true })).toBe('in_progress')
    expect(columnOf({ status: 'completed', ready: true })).toBe('done')
    expect(columnOf({ status: 'deleted', ready: true })).toBeUndefined()
  })

  it('allows only the Lead transitions', () => {
    expect(moveAction('todo', 'in_progress')).toBe('claim')
    expect(moveAction('in_progress', 'todo')).toBe('release')
    expect(moveAction('in_progress', 'done')).toBe('complete')
    expect(moveAction('done', 'todo')).toBe('reopen')
    expect(moveAction('blocked', 'todo')).toBeUndefined()
    expect(moveAction('todo', 'done')).toBeUndefined()
    expect(targetsFrom('blocked')).toEqual([])
    expect(targetsFrom('in_progress')).toEqual(['todo', 'done'])
  })
})

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

async function mount(update: (caller: unknown, request: unknown) => Promise<{ revision: number }>, isRoot = true) {
  const ctx = new Context()
  contexts.push(ctx)
  const lead = { id: 'lead' }
  const updateTask = vi.fn(update)
  ctx.provide('agentTeams', { updateTask } as never)
  ctx.provide('subagents', { rootOf: (agent: unknown) => isRoot ? agent : { id: 'other' } } as never)
  await ctx.plugin(CrewKanban)
  return { ctx, lead, updateTask }
}

describe('move', () => {
  it('updates the task as the Lead with the expected revision', async () => {
    const { ctx, lead, updateTask } = await mount(async () => ({ revision: 4 }))
    expect(await ctx.crewKanban.move(lead as never, '3', 3, 'in_progress', 'done')).toEqual({ ok: true, revision: 4 })
    expect(updateTask).toHaveBeenCalledWith(lead, { taskId: '3', expectedRevision: 3, action: 'complete' })
  })

  it('refuses moves the board does not allow and moves from a non-Lead Session', async () => {
    const { ctx, lead, updateTask } = await mount(async () => ({ revision: 1 }))
    expect(await ctx.crewKanban.move(lead as never, '1', 1, 'blocked', 'done')).toMatchObject({ ok: false })
    expect(updateTask).not.toHaveBeenCalled()
    const other = await mount(async () => ({ revision: 1 }), false)
    const refused = await other.ctx.crewKanban.move(other.lead as never, '1', 1, 'todo', 'in_progress')
    expect(refused.ok ? '' : refused.message).toContain('Team Lead')
  })

  it('reports the Team refusal, such as a stale revision', async () => {
    const { ctx, lead } = await mount(async () => { throw new Error('team task "2" changed') })
    expect(await ctx.crewKanban.move(lead as never, '2', 1, 'done', 'todo')).toEqual({ ok: false, message: 'team task "2" changed' })
  })
})
