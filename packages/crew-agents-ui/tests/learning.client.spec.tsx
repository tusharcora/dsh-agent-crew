// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { CrewImproveState, CrewLesson, CrewProposal } from '@deepseek-ai/dsh-experimental-crew-improve/types'
import { t } from './translate.client.ts'
import { CrewLearning } from '../src/client/CrewLearning.tsx'
import { LearningStore, type LearningHost } from '../src/client/learning.ts'

afterEach(cleanup)

const proposal: CrewProposal = {
  id: 'p1', member: 'crew-mail', text: 'Summarize long threads in three bullets.', evidence: 'too long, give me bullets',
  sessionId: 'mail-1', proposedAt: '2026-11-04T23:00:00.000Z', trigger: 'feedback',
}

/** A Host that keeps lessons in memory and approves like crew-improve does. */
function host(over: Partial<LearningHost> = {}) {
  let state: CrewImproveState = { members: [{ member: 'crew-mail', lessons: [], proposals: [proposal] }] }
  const fake: LearningHost = {
    learning: vi.fn(async () => state),
    approve: vi.fn(async (id: string) => {
      const lesson: CrewLesson = { ...proposal, id, approvedAt: '2026-11-04T23:05:00.000Z' }
      state = { members: [{ member: 'crew-mail', lessons: [lesson], proposals: [] }] }
      return { ok: true as const }
    }),
    reject: vi.fn(async () => { state = { members: [] }; return { ok: true as const } }),
    forget: vi.fn(async () => { state = { members: [] }; return { ok: true as const } }),
    ...over,
  }
  return fake
}

async function mount(fake: LearningHost) {
  const store = new LearningStore(fake)
  await act(async () => {
    render(<CrewLearning
      useLearning={selector => selector(useSyncExternalStore(
        listener => store.source.subscribe(listener), () => store.source.getSnapshot()))}
      refreshLearning={() => store.refresh()} decide={(decision, id) => store.decide(decision, id)} t={t} />)
  })
  return store
}

it('shows a proposal with its member, evidence and time, and changes nothing until Approve is clicked', async () => {
  const fake = host()
  await mount(fake)
  const card = screen.getByRole('article', { name: 'Lesson proposed by Mail' })
  expect(card.textContent).toContain('Summarize long threads in three bullets.')
  expect(card.textContent).toContain('Evidence: “too long, give me bullets”')
  expect(card.textContent).toContain('From your rating,')
  expect(fake.approve).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Approve lesson for Mail' })) })
  expect(fake.approve).toHaveBeenCalledWith('p1')
  expect(screen.getByText('No proposed lessons.')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Remove Mail’s lesson: Summarize long threads in three bullets.' })).toBeTruthy()
})

it('rejects and removes only on click', async () => {
  const fake = host()
  await mount(fake)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reject lesson for Mail' })) })
  expect(fake.reject).toHaveBeenCalledWith('p1')
  expect(screen.getByText('No approved lessons yet.')).toBeTruthy()
})

it('says why a decision failed', async () => {
  await mount(host({ approve: vi.fn(async () => ({ ok: false as const, message: 'crew-mail already has 12 lessons; remove one first' })) }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Approve lesson for Mail' })) })
  expect(screen.getByRole('alert').textContent).toContain('remove one first')
})

it('reports an unreachable Host and the last failed review', async () => {
  await mount(host({ learning: vi.fn(async () => undefined) }))
  expect(screen.getByRole('alert').textContent).toBe('Couldn’t reach dsh to read lessons. Try again.')
  cleanup()
  await mount(host({ learning: vi.fn(async () => ({ members: [], lastError: 'model unavailable' })) }))
  expect(screen.getByText('The last review of a chat failed: model unavailable')).toBeTruthy()
})
