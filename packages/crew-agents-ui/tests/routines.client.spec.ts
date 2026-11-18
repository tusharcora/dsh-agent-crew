import { describe, expect, it } from 'vitest'
import type { ScheduleCatalogEntry } from '@deepseek-ai/dsh-schedule/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { routineProblem, routineRequest, routinesIn, WEEKDAYS } from '../src/client/routines.ts'

const entry = (id: string, sessionId: string, timing: Record<string, unknown>, status = 'active'): ScheduleCatalogEntry => ({
  id, title: id, prompt: `do ${id}`, scheduledAt: '2026-11-13T13:00:00.000Z', timeZone: 'America/New_York',
  target: { kind: 'session', sessionId: SessionId(sessionId) }, involvedSessionIds: [], status, ...timing,
}) as never

describe('routines', () => {
  it('lists daily and weekly schedules delivered into the member\'s Sessions, earliest first', () => {
    const catalog = [
      entry('weekly', 'home', { kind: 'weekly', time: '17:30:00.000', weekdays: [5, 1] }),
      entry('daily', 'home', { kind: 'daily', time: '08:00:00.000' }),
      entry('other-member', 'elsewhere', { kind: 'daily', time: '07:00:00.000' }),
      entry('ended', 'home', { kind: 'daily', time: '06:00:00.000' }, 'ended'),
      entry('every', 'home', { kind: 'every', everySeconds: 60 }),
    ]
    expect(routinesIn(catalog, new Set([SessionId('home')]))).toEqual([
      { id: 'daily', title: 'daily', prompt: 'do daily', days: [...WEEKDAYS], time: '08:00', active: true },
      { id: 'weekly', title: 'weekly', prompt: 'do weekly', days: [1, 5], time: '17:30', active: true },
    ])
  })

  it('checks the form', () => {
    const ok = { title: 'Brief', prompt: 'Brief me', days: [1], time: '08:00' }
    expect(routineProblem(ok)).toBeUndefined()
    expect(routineProblem({ ...ok, title: ' ' })).toBe('routine.needsTitle')
    expect(routineProblem({ ...ok, prompt: '' })).toBe('routine.needsPrompt')
    expect(routineProblem({ ...ok, days: [] })).toBe('routine.needsDays')
    expect(routineProblem({ ...ok, time: '25:00' })).toBe('routine.needsTime')
  })

  it('makes every day a daily schedule and fewer days a weekly one, delivered into the given Session', () => {
    const home = SessionId('home')
    expect(routineRequest({ title: ' Brief ', prompt: ' Brief me ', days: [...WEEKDAYS], time: '08:00' }, home, 'America/New_York')).toEqual({
      title: 'Brief', prompt: 'Brief me', timing: { kind: 'daily', daily: { time: '08:00:00', time_zone: 'America/New_York' } },
      target: { kind: 'session', sessionId: home },
    })
    expect(routineRequest({ title: 'W', prompt: 'p', days: [5, 1, 1], time: '17:30' }, home, 'UTC').timing)
      .toEqual({ kind: 'weekly', weekly: { time: '17:30:00', time_zone: 'UTC', weekdays: [1, 5] } })
  })
})
