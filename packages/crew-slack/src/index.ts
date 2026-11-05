/**
 * Crew Slack: ping the crew in Slack while this computer runs dsh. A Socket Mode connection, opened from this
 * computer, receives mentions of the Crew app and direct messages to it. Each Slack thread is one dsh Session running
 * the crew member the message names. A member's reply becomes a draft with an approval card in the owner's direct
 * messages; nothing is posted until the owner clicks Post reply, there or in the Crew tab.
 * @module @deepseek-ai/dsh-crew-slack
 */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionRequestId } from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-crew-roster'
import type {} from '@deepseek-ai/dsh-crew-connections'
import type {} from '@deepseek-ai/dsh-session-title'
import { approvalCard, readEnvelope, route, slackCall, type Click, type Fetch, type Incoming } from './slack.ts'
import type { SlackDraft, SlackResult, SlackState, SlackStatus } from './types.ts'

export type * from './types.ts'
export { approvalCard, readEnvelope, route, slackCall, type Click, type Fetch, type Incoming, type RouteMember } from './slack.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The crew's Slack connection and the replies waiting for approval. */
    crewSlack: CrewSlack
  }
}

/** Credential store entries; the tokens stay in the store and never reach a file or the browser. */
export const SLACK_REFS = {
  appToken: 'CREW_SLACK_APP_TOKEN',
  botToken: 'CREW_SLACK_BOT_TOKEN',
  owner: 'CREW_SLACK_OWNER_ID',
} as const

/** Network seams tests replace. */
export const internals: { fetch: Fetch; WebSocket: typeof WebSocket; reconnectMs: number } = {
  fetch: (url, init) => fetch(url, init),
  WebSocket: globalThis.WebSocket,
  reconnectMs: 5000,
}

/** Plugin config. */
export interface Config {
  /** Folder holding `slack.json` (threads and drafts) and the folder chats run in when no member folder exists. */
  homeDirectory: string
  /** Slack user ids besides the owner whose messages the crew answers. */
  allowedUsers: string[]
  /** Member that answers a new thread naming nobody. */
  fallbackMember: string
  /** Minutes to wait for a member's reply before giving up on it. */
  replyTimeoutMinutes: number
  /** Drafts kept in the file, newest first. */
  keepDrafts: number
}

/** Config schema. */
export const Config: z<Config> = z.object({
  homeDirectory: z.string().required().description('Folder holding slack.json.'),
  allowedUsers: z.array(z.string()).default([]).description('Slack user ids besides the owner the crew answers.'),
  fallbackMember: z.string().default('crew-chief').description('Member for a new thread that names nobody.'),
  replyTimeoutMinutes: z.number().min(1).max(240).default(30).description('Minutes to wait for a reply.'),
  keepDrafts: z.number().min(1).max(500).default(50).description('Drafts kept in the file.'),
})

interface StoreFile {
  readonly version: 1
  /** Slack `channel:thread` to the Session answering it. */
  readonly threads: Readonly<Record<string, { readonly sessionId: string; readonly member: string }>>
  readonly drafts: readonly SlackDraft[]
}

interface Waiter {
  readonly resolve: (text: string) => void
  readonly reject: (error: Error) => void
  text: string
}

/**
 * The prompt a member receives for one Slack message.
 * @param message - the Slack message.
 * @param question - its text without the addressing.
 * @returns the prompt text.
 */
export function slackPrompt(message: Pick<Incoming, 'user' | 'channel' | 'direct'>, question: string): string {
  const where = message.direct ? 'a direct message' : `<#${message.channel}>`
  return `Slack message from <@${message.user}> in ${where}:\n\n${question}\n\n`
    + 'Reply the way you would in Slack to a teammate: short, plain sentences, no headings or reports. The user approves your '
    + 'reply before it is posted, so write only the message itself.'
}

/** The Slack connection, thread Sessions and reply drafts. */
export class CrewSlack extends TypertRemoteService {
  static inject = ['credentials', 'sessionController', 'crewRoster']
  static Config = Config
  private file: StoreFile = { version: 1, threads: {}, drafts: [] }
  private writes: Promise<unknown> = Promise.resolve()
  private state: SlackState = 'off'
  private detail: string | undefined
  private socket: WebSocket | undefined
  private botUser: string | undefined
  private owner: string | undefined
  private stopped = false
  private retry: ReturnType<typeof setTimeout> | undefined
  private readonly waiters = new Map<string, Waiter[]>()

  /**
   * @param ctx - owning plugin context.
   * @param config - plugin config.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewSlack')
  }

  protected async [Service.init](): Promise<void> {
    await this.load()
    this.ctx.on('session/event', (session, event) => {
      const waiting = this.waiters.get(session.id)?.[0]
      if (waiting === undefined) return
      if (event.type === 'assistant/message') {
        const text = event.data.message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
        if (text !== '') waiting.text = text
      } else if (event.type === 'turn/end') {
        this.waiters.get(session.id)?.shift()
        if (waiting.text === '') waiting.reject(new Error(`the turn ended (${JSON.stringify(event.data.reason)}) without a reply`))
        else waiting.resolve(waiting.text)
      }
    })
    this.ctx.effect(() => () => {
      this.stopped = true
      clearTimeout(this.retry)
      this.socket?.close()
    }, 'crew-slack.socket')
    void this.connect()
  }

  private get path(): string {
    return join(this.config.homeDirectory, 'slack.json')
  }

  private async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as Partial<StoreFile>
      this.file = { version: 1, threads: parsed.threads ?? {}, drafts: parsed.drafts ?? [] }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.ctx.logger.warn(`crew-slack: ${this.path} unreadable: ${String(error)}`)
    }
  }

  /** Apply one change, then save it; changes are written in order. */
  private change(mutate: (file: StoreFile) => StoreFile): Promise<void> {
    this.file = mutate(this.file)
    const snapshot = this.file
    const body = `${JSON.stringify(snapshot, null, 2)}\n`
    const result = this.writes.then(() => writeFileAtomic(this.path, body, { mode: 0o600, dirMode: 0o700 }))
    this.writes = result.catch((error: unknown) => { this.ctx.logger.warn(`crew-slack: ${this.path} not saved: ${String(error)}`) })
    return result
  }

  private setState(state: SlackState, detail?: string): void {
    this.state = state
    this.detail = detail
  }

  private async secret(ref: string): Promise<string | undefined> {
    try {
      const value = (await this.ctx.credentials.resolve(credentialRef(ref)))?.value.trim()
      return value === undefined || value === '' ? undefined : value
    } catch (_error: unknown) {
      return undefined
    }
  }

  /** Open the Socket Mode connection; a dropped connection reopens after a pause while the plugin runs. */
  private async connect(): Promise<void> {
    clearTimeout(this.retry)
    this.socket?.close()
    this.socket = undefined
    const refs = [SLACK_REFS.appToken, SLACK_REFS.botToken, SLACK_REFS.owner]
    const [appToken, botToken, owner] = await Promise.all(refs.map(ref => this.secret(ref)))
    if (appToken === undefined || botToken === undefined || owner === undefined) {
      this.setState('needs-tokens', 'Store the app token, the bot token and your Slack member id in the Crew tab.')
      return
    }
    this.owner = owner
    this.setState('connecting')
    try {
      const auth = await slackCall<{ user_id?: string }>(internals.fetch, botToken, 'auth.test')
      if (!auth.ok) throw new Error(`bot token refused: ${auth.error ?? 'unknown error'}`)
      this.botUser = auth.user_id
      const opened = await slackCall<{ url?: string }>(internals.fetch, appToken, 'apps.connections.open')
      if (!opened.ok || opened.url === undefined) throw new Error(`app token refused: ${opened.error ?? 'no URL'}`)
      const socket = new internals.WebSocket(opened.url)
      this.socket = socket
      socket.addEventListener('message', (message) => { this.receive(socket, String(message.data), botToken) })
      socket.addEventListener('close', () => {
        if (this.socket !== socket || this.stopped) return
        this.setState('connecting', 'Slack closed the connection; reconnecting.')
        this.retry = setTimeout(() => { void this.connect() }, internals.reconnectMs)
      })
    } catch (error: unknown) {
      this.setState('failed', error instanceof Error ? error.message : String(error))
      if (!this.stopped) this.retry = setTimeout(() => { void this.connect() }, internals.reconnectMs * 12)
    }
  }

  private receive(socket: WebSocket, raw: string, botToken: string): void {
    const envelope = readEnvelope(raw, this.botUser)
    // Slack resends an envelope that is not acknowledged within three seconds.
    if (envelope.ack !== undefined) socket.send(JSON.stringify({ envelope_id: envelope.ack }))
    if (raw.includes('"type":"hello"')) this.setState('connected')
    if (envelope.reconnect === true) socket.close()
    if (envelope.incoming !== undefined) void this.answer(envelope.incoming, botToken).catch((error: unknown) => {
      this.ctx.logger.warn(`crew-slack: no reply drafted: ${String(error)}`)
    })
    if (envelope.click !== undefined) void this.click(envelope.click)
  }

  /** Run one Slack message through its thread's member and turn the reply into a draft with an approval card. */
  private async answer(message: Incoming, botToken: string): Promise<void> {
    const allowed = message.user === this.owner || this.config.allowedUsers.includes(message.user)
    if (!allowed) {
      this.ctx.logger.info(`crew-slack: ignored a message from ${message.user}, who is not the owner or an allowed user`)
      return
    }
    const key = `${message.channel}:${message.threadTs ?? message.ts}`
    const thread = this.file.threads[key]
    const members = (await this.ctx.crewRoster.state()).members
    const { member, question } = route(message.text, members, thread?.member, this.config.fallbackMember)
    if (!members.some(entry => entry.id === member)) throw new Error(`no crew member ${member}`)
    const sessionId = thread?.member === member ? thread.sessionId : await this.startSession(member, question)
    if (thread?.sessionId !== sessionId) {
      await this.change(file => ({ ...file, threads: { ...file.threads, [key]: { sessionId, member } } }))
    }
    const reply = this.waitForReply(sessionId)
    await this.ctx.sessionController.prompt({
      requestId: randomUUID() as SessionRequestId, sessionId: SessionId(sessionId), mode: 'queue',
      content: [{ type: 'text', text: slackPrompt(message, question) }],
    }, new AbortController().signal)
    const text = await reply
    const draft: SlackDraft = {
      id: `draft-${randomUUID().slice(0, 8)}`, member, sessionId, channel: message.channel, threadTs: message.threadTs ?? message.ts,
      askedBy: message.user, question, text, status: 'pending', createdAt: new Date().toISOString(),
    }
    await this.change(file => ({ ...file, drafts: [draft, ...file.drafts].slice(0, this.config.keepDrafts) }))
    await this.sendCard(draft, members.find(entry => entry.id === member)?.name ?? member, botToken)
  }

  private async startSession(member: string, question: string): Promise<string> {
    const sessionId = `session-${randomUUID()}`
    const folder = await this.ctx.get('crewConnections')?.memberDirectory(member)
    const cwd = folder?.ok === true ? folder.path : join(this.config.homeDirectory, 'slack')
    await mkdir(cwd, { recursive: true })
    await this.ctx.sessionController.create({ sessionId: SessionId(sessionId), cwd, agentPreset: member })
    try {
      const resolved = await this.ctx.sessionController.resolveAgent(SessionId(sessionId))
      if (!('error' in resolved)) this.ctx.get('sessionTitle')?.rename(resolved.agent.session, `Slack: ${question.slice(0, 60)}`)
    } catch (_error: unknown) {
      // A title is cosmetic; the chat works untitled.
    }
    return sessionId
  }

  private waitForReply(sessionId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(sessionId) ?? []
        this.waiters.set(sessionId, list.filter(entry => entry !== waiter))
        reject(new Error('no reply in time'))
      }, this.config.replyTimeoutMinutes * 60_000)
      const waiter: Waiter = {
        text: '',
        resolve: (text) => { clearTimeout(timer); resolve(text) },
        reject: (error) => { clearTimeout(timer); reject(error) },
      }
      this.waiters.set(sessionId, [...this.waiters.get(sessionId) ?? [], waiter])
    })
  }

  private async sendCard(draft: SlackDraft, memberName: string, botToken: string): Promise<void> {
    if (this.owner === undefined) return
    const dm = await slackCall<{ channel?: { id?: string } }>(internals.fetch, botToken, 'conversations.open', { users: this.owner })
    const channel = dm.channel?.id
    if (!dm.ok || channel === undefined) throw new Error(`could not open your direct messages: ${dm.error ?? 'unknown error'}`)
    const posted = await slackCall<{ ts?: string }>(internals.fetch, botToken, 'chat.postMessage', { channel, ...approvalCard(draft, memberName) })
    if (!posted.ok || posted.ts === undefined) throw new Error(`could not send the approval card: ${posted.error ?? 'unknown error'}`)
    const ts = posted.ts
    const withCard = (entry: SlackDraft): SlackDraft => entry.id === draft.id ? { ...entry, card: { channel, ts } } : entry
    await this.change(file => ({ ...file, drafts: file.drafts.map(withCard) }))
  }

  private async click(click: Click): Promise<void> {
    // Only the owner decides; anyone else who sees a forwarded card cannot post through it.
    if (click.user !== this.owner) return
    const result = await this.decide(click.draftId, click.action)
    if (!result.ok) this.ctx.logger.warn(`crew-slack: ${result.message}`)
  }

  /**
   * Where the connection stands and the recent drafts.
   * @returns the status.
   */
  @Remote('status')
  status(): Promise<SlackStatus> {
    return Promise.resolve({ state: this.state, ...this.detail === undefined ? {} : { detail: this.detail }, drafts: this.file.drafts })
  }

  /**
   * Reconnect, for example after the tokens were stored.
   * @returns the state after the attempt.
   */
  @Remote('reconnect')
  async reconnect(): Promise<SlackState> {
    await this.connect()
    return this.state
  }

  /**
   * Post or discard a pending draft. Posting is the only way a crew reply reaches Slack.
   * @param id - draft id.
   * @param action - `post` or `discard`.
   * @param text - edited reply text to post instead of the draft's.
   * @returns success, or why nothing happened.
   */
  @Remote('decide')
  async decide(id: string, action: 'post' | 'discard', text?: string): Promise<SlackResult> {
    const draft = this.file.drafts.find(entry => entry.id === id)
    if (draft === undefined) return { ok: false, message: 'That draft no longer exists.' }
    if (draft.status !== 'pending') return { ok: false, message: `That draft was already ${draft.status}.` }
    const botToken = await this.secret(SLACK_REFS.botToken)
    if (botToken === undefined) return { ok: false, message: 'Store the bot token first.' }
    const body = (text ?? draft.text).trim()
    if (action === 'post') {
      if (body === '') return { ok: false, message: 'The reply is empty.' }
      const reply = { channel: draft.channel, thread_ts: draft.threadTs, text: body }
      const posted = await slackCall(internals.fetch, botToken, 'chat.postMessage', reply)
      if (!posted.ok) return { ok: false, message: `Slack refused the reply: ${posted.error ?? 'unknown error'}` }
    }
    const status = action === 'post' ? 'posted' as const : 'discarded' as const
    await this.change(file => ({ ...file, drafts: file.drafts.map(entry => entry.id === id ? { ...entry, status, text: body } : entry) }))
    if (draft.card !== undefined) {
      const note = action === 'post' ? `Posted to <#${draft.channel}>:\n${body}` : 'Discarded; nothing was posted.'
      await slackCall(internals.fetch, botToken, 'chat.update', {
        channel: draft.card.channel, ts: draft.card.ts, text: note, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: note.slice(0, 2900) } }],
      }).catch((error: unknown) => { this.ctx.logger.warn(`crew-slack: card not updated: ${String(error)}`) })
    }
    return { ok: true, value: true }
  }
}

export default CrewSlack
