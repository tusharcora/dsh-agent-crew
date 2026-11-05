import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { createAssistantMessage, createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type { MessageFeedbackVersion } from '@deepseek-ai/dsh-message-feedback'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CrewImprove, { lessonsSection, memberOf, parseProposals, transcriptOf } from '../src/index.ts'
import * as Lessons from '../src/lessons.ts'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  vi.useRealTimers()
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

/** A fake model that answers every call with `reply` and records what it was asked. */
function fakeLlm(reply: () => string) {
  const calls: GenerateOptions[] = []
  return {
    calls,
    service: {
      prepareCall: async (config: { provider: string; model: string }) => ({
        config,
        stream: async function* (options: GenerateOptions): AsyncIterable<StreamChunk> {
          calls.push(options)
          const text = reply()
          yield { type: 'block-start', index: 0, blockType: 'text' }
          yield { type: 'text-delta', index: 0, text }
          yield { type: 'block-end', index: 0, block: { type: 'text', text } }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      }),
    },
  }
}

async function setup(reply: () => string, maxLessonsPerMember = 12) {
  const home = await mkdtemp(join(tmpdir(), 'crew-improve-'))
  const ctx = new Context()
  cleanups.push(async () => { await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
  const llm = fakeLlm(reply)
  ctx.provide('llm', llm.service as never)
  ctx.provide('agentPresets', { presetForSession: (session: Session) => session.header.agentPreset ?? null } as never)
  await ctx.plugin(SessionStore)
  await ctx.plugin(CrewImprove, CrewImprove.Config({
    homeDirectory: home, debounceSeconds: 1, reflectEveryUserMessages: 2, provider: 'fixture', model: 'fixture-model', maxLessonsPerMember,
    maxTranscriptChars: 24000, maxOutputTokens: 2000, timeoutMs: 120000,
  }))
  return { ctx, home, llm }
}

function converse(session: Session, user: string, answer: string) {
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: user }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  const message = createAssistantMessage({ content: [{ type: 'text', text: answer }], source: { provider: 'fixture', model: 'fixture-model' } })
  session.append('assistant/message', { turn: 1, step: 1, stream: [], message }, { surfaceOp: 'append' })
  return message
}

function rate(session: Session, messageId: ReturnType<typeof converse>['id'], note: string) {
  session.append('feedback/message-put', { sessionId: session.id, item: {
    messageId, rating: 'negative', note, version: 'v1' as MessageFeedbackVersion, createdAt: 1, updatedAt: 1,
  } })
}

const PROPOSALS = JSON.stringify({ proposals: [
  { lesson: 'Summarize long threads in three bullet points first.', evidence: 'too long, give me bullets', replaces: null },
  { lesson: '', evidence: 'empty lessons are dropped' },
] })

describe('reflection', () => {
  it('reflects after a rating, shows the conversation and rating to the model, and stores the proposal', async () => {
    vi.useFakeTimers()
    const { ctx, home, llm } = await setup(() => PROPOSALS)
    const session = ctx.sessions.create(SessionId('mail-1'), { meta: { agentPreset: 'crew-mail' } })
    const answer = converse(session, 'Summarize my inbox', 'Here is a long summary of every thread...')
    rate(session, answer.id, 'too long, give me bullets')
    await vi.advanceTimersByTimeAsync(1500)
    await vi.waitFor(async () => { expect((await ctx.crewImprove.learning()).members).toHaveLength(1) })
    expect(llm.calls).toHaveLength(1)
    const input = JSON.stringify(llm.calls[0]?.messages)
    expect(input).toContain('Summarize my inbox')
    expect(input).toContain('negative')
    expect(input).toContain('too long, give me bullets')
    expect(llm.calls[0]?.purpose).toBe('crew-improve')
    const [mail] = (await ctx.crewImprove.learning()).members
    expect(mail).toMatchObject({ member: 'crew-mail', lessons: [], proposals: [{
      text: 'Summarize long threads in three bullet points first.', evidence: 'too long, give me bullets', sessionId: 'mail-1', trigger: 'feedback',
    }] })
    expect(await readFile(join(home, 'learning.json'), 'utf8')).toContain('three bullet points')
  })

  it('ignores Sessions that are not a crew member\'s and counts user messages for crew ones', async () => {
    vi.useFakeTimers()
    const { ctx, llm } = await setup(() => PROPOSALS)
    const other = ctx.sessions.create(SessionId('plain'), { meta: { agentPreset: 'standard' } })
    rate(other, converse(other, 'hi', 'hello').id, 'meh')
    const research = ctx.sessions.create(SessionId('research-1'), { meta: { agentPreset: 'crew-research' } })
    converse(research, 'find sources', 'one source')
    await vi.advanceTimersByTimeAsync(1500)
    expect(llm.calls).toHaveLength(0)
    converse(research, 'no, cite primary sources', 'here are primary sources')
    await vi.advanceTimersByTimeAsync(1500)
    await vi.waitFor(() => { expect(llm.calls).toHaveLength(1) })
    await vi.waitFor(async () => {
      expect((await ctx.crewImprove.learning()).members[0]).toMatchObject({ member: 'crew-research', proposals: [{ trigger: 'turns' }] })
    })
  })
})

describe('approval', () => {
  async function proposed() {
    const fixture = await setup(() => PROPOSALS)
    const session = fixture.ctx.sessions.create(SessionId('mail-2'), { meta: { agentPreset: 'crew-mail' } })
    converse(session, 'Summarize', 'Long answer')
    const [proposal] = await fixture.ctx.crewImprove.reflect(session, 'feedback')
    if (proposal === undefined) throw new Error('no proposal')
    return { ...fixture, session, proposal }
  }

  it('turns an approved proposal into a lesson in the member\'s prompt section', async () => {
    const { ctx, proposal } = await proposed()
    expect(ctx.crewImprove.section('crew-mail')).toBe('')
    expect(await ctx.crewImprove.approve(proposal.id)).toEqual({ ok: true })
    expect(ctx.crewImprove.lessons('crew-mail')).toMatchObject([{ id: proposal.id, text: proposal.text }])
    expect(ctx.crewImprove.section('crew-mail')).toContain(`- ${proposal.text}`)
    expect(ctx.crewImprove.section('crew-life')).toBe('')
    expect(await ctx.crewImprove.approve(proposal.id)).toMatchObject({ ok: false })
  })

  it('never proposes a rejected or removed lesson again', async () => {
    const { ctx, session, proposal } = await proposed()
    expect(await ctx.crewImprove.reject(proposal.id)).toEqual({ ok: true })
    expect(await ctx.crewImprove.reflect(session, 'feedback')).toEqual([])
    expect((await ctx.crewImprove.learning()).members).toEqual([])
  })

  it('keeps at most the configured number of lessons and lets a proposal replace one', async () => {
    let reply = PROPOSALS
    const fixture = await setup(() => reply, 1)
    const session = fixture.ctx.sessions.create(SessionId('mail-3'), { meta: { agentPreset: 'crew-mail' } })
    converse(session, 'Summarize', 'Long answer')
    const [first] = await fixture.ctx.crewImprove.reflect(session, 'feedback')
    await fixture.ctx.crewImprove.approve(first!.id)
    reply = JSON.stringify({ proposals: [
      { lesson: 'Lead with the one thread that needs a reply today.', evidence: 'what needs me today?', replaces: null },
      { lesson: 'Summarize long threads in two bullet points.', evidence: 'still too long', replaces: first!.id },
    ] })
    const [extra, replacement] = await fixture.ctx.crewImprove.reflect(session, 'feedback')
    const refused = await fixture.ctx.crewImprove.approve(extra!.id)
    expect(refused.ok ? '' : refused.message).toContain('remove one first')
    expect(await fixture.ctx.crewImprove.approve(replacement!.id)).toEqual({ ok: true })
    expect(fixture.ctx.crewImprove.lessons('crew-mail').map(lesson => lesson.text)).toEqual(['Summarize long threads in two bullet points.'])
    expect(await fixture.ctx.crewImprove.forget(replacement!.id)).toEqual({ ok: true })
    expect(fixture.ctx.crewImprove.lessons('crew-mail')).toEqual([])
  })

  it('records a failed reflection instead of throwing', async () => {
    const fixture = await setup(() => { throw new Error('model unavailable') })
    const session = fixture.ctx.sessions.create(SessionId('mail-4'), { meta: { agentPreset: 'crew-mail' } })
    converse(session, 'hi', 'hello')
    expect(await fixture.ctx.crewImprove.reflect(session, 'turns')).toEqual([])
    expect(await fixture.ctx.crewImprove.learning()).toMatchObject({ lastError: 'model unavailable' })
  })
})

describe('lessons row', () => {
  it('adds the member\'s lessons as a literal prompt section in its preset scope', async () => {
    const { ctx } = await setup(() => PROPOSALS)
    const sections: Array<{ name: string; order: number; interpolate?: boolean; text: string | (() => string) }> = []
    ctx.provide('systemPrompt', { section: (section: (typeof sections)[number]) => { sections.push(section); return () => undefined } } as never)
    await ctx.plugin(Lessons, { member: 'crew-mail' })
    expect(sections).toMatchObject([{ name: 'crew-lessons', order: Lessons.LESSONS_ORDER, interpolate: false }])
    const text = sections[0]?.text
    expect(typeof text === 'function' ? text() : text).toBe('')
  })
})

describe('reflector helpers', () => {
  it('treats only crew presets as members', () => {
    expect(memberOf('crew-code')).toBe('crew-code')
    expect(memberOf('standard')).toBeUndefined()
    expect(memberOf(null)).toBeUndefined()
  })

  it('places each rating after its message and keeps the newest lines within budget', () => {
    const user = (text: string) => createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
    const answer = createAssistantMessage({ content: [{ type: 'text', text: 'answer' }], source: { provider: 'p', model: 'm' } })
    const rating = { messageId: answer.id, rating: 'positive' as const, version: 'v' as MessageFeedbackVersion, createdAt: 1, updatedAt: 1 }
    expect(transcriptOf([user('first message'), answer, user('second message')], [rating], 1000))
      .toBe(`[user] first message\n[assistant ${answer.id}] answer\n[user rated assistant ${answer.id} positive]\n[user] second message`)
    expect(transcriptOf([user('first message'), user('second message')], [], 30)).toBe('[user] second message')
  })

  it('accepts only well-formed, new, evidence-backed proposals and valid replacement ids', () => {
    const output = `Sure:\n${JSON.stringify({ proposals: [
      { lesson: 'Cite primary sources.', evidence: 'primary please', replaces: 'missing' },
      { lesson: 'cite PRIMARY sources', evidence: 'dup' },
      { lesson: 'Known lesson', evidence: 'x' },
      { lesson: 'No evidence' },
      { lesson: 'Prefer tables.', evidence: 'table', replaces: 'l1' },
      { lesson: 'Fourth.', evidence: 'x' },
      { lesson: 'Fifth.', evidence: 'x' },
    ] })}`
    expect(parseProposals(output, new Set(['l1']), new Set(['known lesson']))).toEqual([
      { text: 'Cite primary sources.', evidence: 'primary please' },
      { text: 'Prefer tables.', evidence: 'table', replaces: 'l1' },
      { text: 'Fourth.', evidence: 'x' },
    ])
    expect(parseProposals('no json here', new Set(), new Set())).toEqual([])
    expect(lessonsSection([])).toBe('')
  })
})
