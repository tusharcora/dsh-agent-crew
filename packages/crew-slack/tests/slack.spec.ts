import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CrewSlack, { approvalCard, internals, readEnvelope, route, slackPrompt } from '../src/index.ts'

const members = [{ id: 'crew-chief', name: 'Chief of staff' }, { id: 'crew-code', name: 'Code' }, { id: 'crew-research', name: 'Research' }]

const mention = (text: string, user = 'UOWNER', extra: Record<string, unknown> = {}) => JSON.stringify({
  envelope_id: 'env-1', type: 'events_api',
  payload: { event: { type: 'app_mention', channel: 'CDEV', user, text, ts: '100.1', ...extra } },
})

describe('readEnvelope', () => {
  it('reads mentions and direct messages, and acknowledges every envelope', () => {
    expect(readEnvelope(mention('<@UBOT> Code, why is CI red?'), 'UBOT')).toEqual({
      ack: 'env-1', incoming: { channel: 'CDEV', user: 'UOWNER', text: '<@UBOT> Code, why is CI red?', ts: '100.1', direct: false },
    })
    const dm = JSON.stringify({ envelope_id: 'e2', type: 'events_api', payload: { event: { type: 'message', channel_type: 'im', channel: 'D1', user: 'UOWNER', text: 'hi', ts: '1.2', thread_ts: '1.1' } } })
    expect(readEnvelope(dm, 'UBOT').incoming).toMatchObject({ direct: true, threadTs: '1.1' })
  })

  it('ignores the bot itself, edits, and channel messages without a mention', () => {
    expect(readEnvelope(mention('x', 'UBOT'), 'UBOT')).toEqual({ ack: 'env-1' })
    expect(readEnvelope(mention('x', 'UOWNER', { subtype: 'message_changed' }), 'UBOT').incoming).toBeUndefined()
    const channel = JSON.stringify({ envelope_id: 'e3', type: 'events_api', payload: { event: { type: 'message', channel_type: 'channel', channel: 'C', user: 'U', text: 'x', ts: '1' } } })
    expect(readEnvelope(channel, 'UBOT').incoming).toBeUndefined()
    expect(readEnvelope('not json', 'UBOT')).toEqual({})
  })

  it('reads approval button clicks and disconnect notices', () => {
    const click = JSON.stringify({ envelope_id: 'e4', type: 'interactive', payload: { type: 'block_actions', user: { id: 'UOWNER' }, actions: [{ action_id: 'crew_post', value: 'draft-1' }] } })
    expect(readEnvelope(click, 'UBOT').click).toEqual({ user: 'UOWNER', action: 'post', draftId: 'draft-1' })
    expect(readEnvelope(JSON.stringify({ type: 'disconnect', envelope_id: 'e5' }), 'UBOT')).toEqual({ ack: 'e5', reconnect: true })
  })
})

describe('route', () => {
  it('picks the member a message opens with, by name, id or short id', () => {
    expect(route('<@UBOT> Code, why is CI red?', members, undefined, 'crew-chief')).toEqual({ member: 'crew-code', question: 'why is CI red?' })
    expect(route('research: compare these', members, undefined, 'crew-chief')).toEqual({ member: 'crew-research', question: 'compare these' })
    expect(route('crew-code fix it', members, undefined, 'crew-chief').member).toBe('crew-code')
    expect(route('Codex is great', members, undefined, 'crew-chief').member).toBe('crew-chief')
  })
  it('keeps the thread\'s member, else the fallback', () => {
    expect(route('<@UBOT> and now?', members, 'crew-code', 'crew-chief')).toEqual({ member: 'crew-code', question: 'and now?' })
    expect(route('plan my week', members, undefined, 'crew-chief').member).toBe('crew-chief')
  })
})

it('builds a card with the question, the draft and Post and Discard buttons, and a teammate-style prompt', () => {
  const card = approvalCard({ id: 'd1', channel: 'CDEV', askedBy: 'UOWNER', question: 'why?', text: 'Because.' }, 'Code')
  expect(JSON.stringify(card.blocks)).toContain('"action_id":"crew_post","value":"d1"')
  expect(JSON.stringify(card.blocks)).toContain('crew_discard')
  expect(slackPrompt({ user: 'U1', channel: 'C1', direct: false }, 'why?')).toContain('Slack message from <@U1> in <#C1>:\n\nwhy?')
})

class FakeSocket {
  static last: FakeSocket | undefined
  readonly sent: string[] = []
  private readonly listeners = new Map<string, ((event: { data?: string }) => void)[]>()
  constructor(readonly url: string) { FakeSocket.last = this }
  addEventListener(type: string, listener: (event: { data?: string }) => void) {
    this.listeners.set(type, [...this.listeners.get(type) ?? [], listener])
  }
  send(data: string) { this.sent.push(data) }
  close() { for (const listener of this.listeners.get('close') ?? []) listener({}) }
  emit(data: string) { for (const listener of this.listeners.get('message') ?? []) listener({ data }) }
}

describe('CrewSlack', () => {
  let home: string | undefined
  afterEach(async () => { if (home !== undefined) await rm(home, { recursive: true, force: true }) })

  async function boot(secrets: Record<string, string> = { CREW_SLACK_APP_TOKEN: 'xapp-1', CREW_SLACK_BOT_TOKEN: 'xoxb-1', CREW_SLACK_OWNER_ID: 'UOWNER' }) {
    home = await mkdtemp(join(tmpdir(), 'crew-slack-'))
    FakeSocket.last = undefined
    const calls: { method: string; token: string; body: Record<string, unknown> }[] = []
    internals.fetch = (url, init) => {
      const method = url.split('/').at(-1) ?? ''
      calls.push({ method, token: String((init?.headers as Record<string, string>)['Authorization']), body: JSON.parse(init?.body as string) as Record<string, unknown> })
      const reply: Record<string, unknown> = {
        'auth.test': { ok: true, user_id: 'UBOT' }, 'apps.connections.open': { ok: true, url: 'wss://slack.test' },
        'conversations.open': { ok: true, channel: { id: 'DOWNER' } }, 'chat.postMessage': { ok: true, ts: '200.1' }, 'chat.update': { ok: true },
      }
      return Promise.resolve(new Response(JSON.stringify(reply[method] ?? { ok: false, error: 'unknown_method' })))
    }
    internals.WebSocket = FakeSocket as never
    const prompts: { sessionId: string; content: { text: string }[] }[] = []
    const created: { sessionId: string; agentPreset: string }[] = []
    const ctx = new Context()
    const resolve = (ref: string) => Promise.resolve(secrets[ref] === undefined ? undefined : { value: secrets[ref] })
    ctx.provide('credentials', { resolve } as never)
    ctx.provide('crewRoster', { state: () => Promise.resolve({ members, connections: [] }) } as never)
    ctx.provide('sessionController', {
      create: (request: { sessionId: string; agentPreset: string }) => { created.push(request); return Promise.resolve({}) },
      resolveAgent: () => Promise.resolve({ error: new Error('no agent in tests') }),
      prompt: (request: { sessionId: string; content: { text: string }[] }) => {
        prompts.push(request)
        return Promise.resolve({ accepted: true })
      },
    } as never)
    await ctx.plugin(CrewSlack, { homeDirectory: home, allowedUsers: [], fallbackMember: 'crew-chief', replyTimeoutMinutes: 1, keepDrafts: 50 })
    const slack = await new Promise<CrewSlack>((resolve) => { ctx.inject(['crewSlack'], (inner) => { resolve(inner.crewSlack) }) })
    await vi.waitFor(() => { expect(FakeSocket.last?.url).toBe('wss://slack.test') })
    const socket = FakeSocket.last!
    socket.emit(JSON.stringify({ type: 'hello' }))
    return { ctx, slack, socket, calls, prompts, created }
  }

  const reply = (ctx: Context, sessionId: string, text: string) => {
    ctx.emit('session/event' as never, { id: sessionId } as never, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } } as never)
    ctx.emit('session/event' as never, { id: sessionId } as never, { type: 'turn/end', data: { reason: 'completed' } } as never)
  }

  it('waits for tokens before connecting', async () => {
    const { slack } = await boot({}).catch(() => ({ slack: undefined }))
    expect(slack).toBeUndefined()
  })

  it('answers the owner in the named member\'s Session, drafts the reply and posts it only when the owner clicks Post', async () => {
    const { ctx, slack, socket, calls, prompts, created } = await boot()
    expect((await slack.status()).state).toBe('connected')
    socket.emit(mention('<@UBOT> Code, why is CI red?'))
    expect(socket.sent).toContain(JSON.stringify({ envelope_id: 'env-1' }))
    await vi.waitFor(() => { expect(prompts).toHaveLength(1) })
    expect(created).toEqual([expect.objectContaining({ agentPreset: 'crew-code' })])
    expect(prompts[0]?.content[0]?.text).toContain('why is CI red?')
    reply(ctx, prompts[0]!.sessionId, 'The lint step fails on main.')
    await vi.waitFor(async () => { expect((await slack.status()).drafts[0]?.card).toEqual({ channel: 'DOWNER', ts: '200.1' }) })
    const draft = (await slack.status()).drafts[0]!
    expect(draft).toMatchObject({ member: 'crew-code', status: 'pending', text: 'The lint step fails on main.', channel: 'CDEV', threadTs: '100.1' })
    expect(calls.filter(call => call.method === 'chat.postMessage').map(call => call.body['channel'])).toEqual(['DOWNER'])

    socket.emit(JSON.stringify({ envelope_id: 'e9', type: 'interactive', payload: { type: 'block_actions', user: { id: 'USTRANGER' }, actions: [{ action_id: 'crew_post', value: draft.id }] } }))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect((await slack.status()).drafts[0]?.status).toBe('pending')

    socket.emit(JSON.stringify({ envelope_id: 'e10', type: 'interactive', payload: { type: 'block_actions', user: { id: 'UOWNER' }, actions: [{ action_id: 'crew_post', value: draft.id }] } }))
    await vi.waitFor(async () => { expect((await slack.status()).drafts[0]?.status).toBe('posted') })
    expect(calls.find(call => call.method === 'chat.postMessage' && call.body['channel'] === 'CDEV')?.body).toEqual({ channel: 'CDEV', thread_ts: '100.1', text: 'The lint step fails on main.' })
    expect(calls.some(call => call.method === 'chat.update')).toBe(true)
    expect(await slack.decide(draft.id, 'post')).toMatchObject({ ok: false })
  })

  it('keeps a thread in one Session, and ignores people who are not allowed', async () => {
    const { ctx, slack, socket, prompts, created } = await boot()
    socket.emit(mention('<@UBOT> Research: find sources'))
    await vi.waitFor(() => { expect(prompts).toHaveLength(1) })
    reply(ctx, prompts[0]!.sessionId, 'Three sources.')
    await vi.waitFor(async () => { expect((await slack.status()).drafts).toHaveLength(1) })
    socket.emit(mention('<@UBOT> and the newest one?', 'UOWNER', { ts: '100.5', thread_ts: '100.1' }))
    await vi.waitFor(() => { expect(prompts).toHaveLength(2) })
    expect(prompts[1]?.sessionId).toBe(prompts[0]?.sessionId)
    expect(created).toHaveLength(1)
    socket.emit(mention('<@UBOT> Code, delete prod', 'USTRANGER', { ts: '300.1' }))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(prompts).toHaveLength(2)
  })

  it('edits the reply before posting from the Crew tab, or discards it', async () => {
    const { ctx, slack, socket, calls, prompts } = await boot()
    socket.emit(mention('<@UBOT> plan my week'))
    await vi.waitFor(() => { expect(prompts).toHaveLength(1) })
    reply(ctx, prompts[0]!.sessionId, 'Draft plan.')
    await vi.waitFor(async () => { expect((await slack.status()).drafts[0]?.card).toBeDefined() })
    const id = (await slack.status()).drafts[0]!.id
    expect(await slack.decide(id, 'post', 'Edited plan.')).toEqual({ ok: true, value: true })
    expect(calls.find(call => call.body['channel'] === 'CDEV')?.body['text']).toBe('Edited plan.')
    socket.emit(mention('<@UBOT> again', 'UOWNER', { ts: '400.1' }))
    await vi.waitFor(() => { expect(prompts).toHaveLength(2) })
    reply(ctx, prompts[1]!.sessionId, 'Second.')
    await vi.waitFor(async () => { expect((await slack.status()).drafts).toHaveLength(2) })
    const second = (await slack.status()).drafts[0]!.id
    expect(await slack.decide(second, 'discard')).toEqual({ ok: true, value: true })
    expect(calls.filter(call => call.body['channel'] === 'CDEV')).toHaveLength(1)
  })
})
