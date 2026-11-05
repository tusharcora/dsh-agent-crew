/**
 * Crew improve: crew members learn from their conversations. After the user rates a crew member's message, or after a
 * few more of the user's messages, a reflector reads the conversation and proposes lessons for that member. The user
 * approves or rejects each one in the Crew tab; approved lessons join the member's system prompt through the
 * `./lessons` row in its preset. Lessons are text only: they cannot change tools, accounts, credentials or the write guard.
 * @module @deepseek-ai/dsh-experimental-crew-improve
 */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { BlockAssembler, createUserMessage, type ContextFormed } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { MessageFeedbackItem } from '@deepseek-ai/dsh-message-feedback'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { deadline } from '@deepseek-ai/dsh-timeout'
import type { CrewImproveResult, CrewImproveState, CrewLearning, CrewLesson, CrewProposal, CrewReflectionTrigger } from './types.ts'
import { lessonKey, lessonsSection, memberOf, parseProposals, reflectionInput, reflectionSystem, transcriptOf, CREW_MEMBER } from './reflect.ts'

export { lessonKey, lessonsSection, memberOf, parseProposals, reflectionInput, reflectionSystem, transcriptOf, CREW_MEMBER, MAX_PROPOSALS } from './reflect.ts'
export type { CrewImproveResult, CrewImproveState, CrewLearning, CrewLesson, CrewProposal, CrewReflectionTrigger } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Crew learning: lessons, proposals and reflection. */
    crewImprove: CrewImprove
  }
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'crew-improve': { kind: 'crew-improve' } & ContextFormed
  }
  interface LlmRequestPurposeMap {
    'crew-improve': true
  }
}

/** Plugin config. */
export interface Config {
  /** Crew home directory; learning is stored in `learning.json` inside it. */
  homeDirectory: string
  /** Reflect after this many new user messages in a crew conversation; 0 reflects only on ratings. */
  reflectEveryUserMessages: number
  /** Wait this long after the last trigger before reflecting, so a rating and its note arrive together. */
  debounceSeconds: number
  /** Most approved lessons a member keeps; approving more needs one removed first. */
  maxLessonsPerMember: number
  /** Transcript budget sent to the reflector, in characters. */
  maxTranscriptChars: number
  /** Reflector output-token cap. */
  maxOutputTokens: number
  /** Reflector deadline in milliseconds. */
  timeoutMs: number
  /** Reflector provider; with `model`, overrides the conversation's own route. */
  provider?: string
  /** Reflector model; with `provider`, overrides the conversation's own route. */
  model?: string
}

/** Runtime config schema. */
export const Config: z<Config> = z.object({
  homeDirectory: z.string().required(),
  reflectEveryUserMessages: z.natural().default(6),
  debounceSeconds: z.number().min(1).default(45),
  maxLessonsPerMember: z.natural().min(1).default(12),
  maxTranscriptChars: z.natural().min(1000).default(24000),
  maxOutputTokens: z.natural().min(200).default(2000),
  timeoutMs: z.natural().min(1000).default(120000),
  provider: z.string(),
  model: z.string(),
})

/** Stored learning for one member. */
interface MemberRecord {
  lessons: CrewLesson[]
  proposals: CrewProposal[]
  /** Keys of rejected lesson texts, so they are not proposed again. */
  rejected: string[]
}

/** The `learning.json` document. */
interface LearningFile {
  version: 1
  members: Record<string, MemberRecord>
}

/** Reflects on crew conversations and keeps each member's lessons. */
export class CrewImprove extends TypertRemoteService {
  static inject = ['llm', 'agentPresets']
  static Config = Config
  private file: LearningFile = { version: 1, members: {} }
  private loaded: Promise<void> | undefined
  private writes: Promise<void> = Promise.resolve()
  private lastReflectedAt: string | undefined
  private lastError: string | undefined
  private readonly userMessages = new Map<string, number>()
  /** The user's current ratings per live Session, kept from delivered events. */
  private readonly ratings = new Map<string, Map<string, MessageFeedbackItem>>()
  private readonly timers = new Map<string, { timer: ReturnType<typeof setTimeout>; trigger: CrewReflectionTrigger }>()
  private readonly running = new Set<string>()

  /**
   * @param ctx - owning plugin context.
   * @param config - storage, triggers and reflector limits.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewImprove')
  }

  protected async [Service.init](): Promise<void> {
    await this.load()
    this.ctx.on('session/event', (session, event) => { this.observe(session, event) }, { global: true })
    this.ctx.on('session/disposed', (session) => {
      this.ratings.delete(session.id)
      this.userMessages.delete(session.id)
    }, { global: true })
    this.ctx.effect(() => async () => {
      for (const { timer } of this.timers.values()) clearTimeout(timer)
      this.timers.clear()
      await this.writes
    }, 'crew-improve.timers')
  }

  private get path(): string {
    return join(this.config.homeDirectory, 'learning.json')
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
        if (typeof parsed === 'object' && parsed !== null && 'members' in parsed && typeof parsed.members === 'object' && parsed.members !== null) {
          this.file = { version: 1, members: parsed.members as Record<string, MemberRecord> }
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    })()
    return this.loaded
  }

  /** Apply one change to a copy, save it, then publish it; changes are serialized and a failed save changes nothing. */
  private change<T>(mutate: (file: LearningFile) => T): Promise<T> {
    const result = this.writes.then(async () => {
      await this.load()
      const next = structuredClone(this.file)
      const value = mutate(next)
      await writeFileAtomic(this.path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
      this.file = next
      return value
    })
    this.writes = result.then(() => undefined, () => undefined)
    return result
  }

  private record(file: LearningFile, member: string): MemberRecord {
    return file.members[member] ??= { lessons: [], proposals: [], rejected: [] }
  }

  /**
   * Approved lessons of one member.
   * @param member - crew member id.
   * @returns lessons, oldest first.
   */
  lessons(member: string): readonly CrewLesson[] {
    return this.file.members[member]?.lessons ?? []
  }

  /**
   * The system-prompt section for one member.
   * @param member - crew member id.
   * @returns section text, empty when it has no lessons.
   */
  section(member: string): string {
    return lessonsSection(this.lessons(member))
  }

  private memberOf(session: Session): string | undefined {
    return memberOf(this.ctx.agentPresets.presetForSession(session))
  }

  /** Keep ratings and count triggers on live crew Sessions, then schedule a reflection. */
  private observe(session: Session, event: SessionEvent): void {
    if (this.memberOf(session) === undefined) return
    if (event.type === 'feedback/message-put') {
      const ratings = this.ratings.get(session.id) ?? new Map<string, MessageFeedbackItem>()
      ratings.set(event.data.item.messageId, event.data.item)
      this.ratings.set(session.id, ratings)
      this.schedule(session, 'feedback')
    } else if (event.type === 'feedback/message-delete') this.ratings.get(session.id)?.delete(event.data.messageId)
    else if (event.type === 'user/message' && event.data.source.kind === 'user' && this.config.reflectEveryUserMessages > 0) {
      const count = (this.userMessages.get(session.id) ?? 0) + 1
      this.userMessages.set(session.id, count)
      if (count >= this.config.reflectEveryUserMessages) this.schedule(session, 'turns')
    }
  }

  private schedule(session: Session, trigger: CrewReflectionTrigger): void {
    const previous = this.timers.get(session.id)
    if (previous !== undefined) clearTimeout(previous.timer)
    // A rating outranks a message count when both arrive within one window.
    const effective = previous?.trigger === 'feedback' ? 'feedback' : trigger
    const timer = setTimeout(() => {
      this.timers.delete(session.id)
      void this.reflect(session, effective)
    }, this.config.debounceSeconds * 1000)
    this.timers.set(session.id, { timer, trigger: effective })
  }

  /**
   * Reflect on one crew conversation now and store its proposals.
   * @param session - a crew member's Session.
   * @param trigger - what asked for the reflection.
   * @returns the new proposals.
   */
  async reflect(session: Session, trigger: CrewReflectionTrigger): Promise<readonly CrewProposal[]> {
    const member = this.memberOf(session)
    if (member === undefined || this.running.has(session.id)) return []
    this.running.add(session.id)
    this.userMessages.set(session.id, 0)
    try {
      await this.load()
      const ratings = [...this.ratings.get(session.id)?.values() ?? []]
      const transcript = transcriptOf(session.deriveMessages(), ratings, this.config.maxTranscriptChars)
      if (transcript === '') return []
      const route = this.config.provider !== undefined && this.config.model !== undefined
        ? { provider: this.config.provider, model: this.config.model }
        : session.requestHeader()?.config
      if (route === undefined) throw new Error('no model route yet: the conversation has not reached a model')
      const lessons = this.lessons(member)
      const output = await this.ask(route.provider, route.model, reflectionSystem(member), reflectionInput(lessons, transcript), session.id)
      const added = await this.change((file) => {
        const record = this.record(file, member)
        const known = new Set([...record.lessons, ...record.proposals].map(entry => lessonKey(entry.text)).concat(record.rejected))
        const proposedAt = new Date().toISOString()
        const proposals = parseProposals(output, new Set(record.lessons.map(lesson => lesson.id)), known).map((parsed): CrewProposal => ({
          id: randomUUID(), member, text: parsed.text, evidence: parsed.evidence, sessionId: session.id, proposedAt, trigger,
          ...parsed.replaces === undefined ? {} : { replaces: parsed.replaces },
        }))
        record.proposals.push(...proposals)
        return proposals
      })
      this.lastReflectedAt = new Date().toISOString()
      this.lastError = undefined
      return added
    } catch (error: unknown) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.ctx.logger('crew-improve').warn('reflection failed: %s', this.lastError)
      return []
    } finally {
      this.running.delete(session.id)
    }
  }

  /** One text-only reflector call. */
  private async ask(provider: string, model: string, system: string, input: string, sessionId: Session['id']): Promise<string> {
    using callDeadline = deadline(undefined, this.config.timeoutMs, 'CREW_IMPROVE_TIMEOUT')
    const call = await this.ctx.llm.prepareCall({ provider, model, maxTokens: this.config.maxOutputTokens }, callDeadline.signal)
    const assembler = new BlockAssembler()
    const messages = [createUserMessage({ content: [{ type: 'text', text: input }], source: { kind: 'crew-improve' } })]
    for await (const chunk of call.stream({ ...call.config, messages, system, sessionId, purpose: 'crew-improve', signal: callDeadline.signal })) {
      callDeadline.signal.throwIfAborted()
      assembler.push(chunk)
    }
    const finish = assembler.finish
    if (finish.kind === 'error' || finish.kind === 'aborted') throw new Error(finish.failure.message)
    return assembler.blocks().flatMap(block => block.type === 'text' ? [block.text] : []).join('')
  }

  /**
   * Lessons and proposals for the Crew tab.
   * @returns every member with learning, and the latest reflection outcome.
   */
  @Remote('learning')
  async learning(): Promise<CrewImproveState> {
    await this.load()
    const members: CrewLearning[] = Object.entries(this.file.members)
      .filter(([member, record]) => CREW_MEMBER.test(member) && (record.lessons.length > 0 || record.proposals.length > 0))
      .map(([member, record]) => ({ member, lessons: record.lessons, proposals: record.proposals }))
    return {
      members,
      ...this.lastReflectedAt === undefined ? {} : { lastReflectedAt: this.lastReflectedAt },
      ...this.lastError === undefined ? {} : { lastError: this.lastError },
    }
  }

  /**
   * Approve a proposal: it becomes a lesson, replacing the lesson it names.
   * @param proposalId - proposal to approve.
   * @returns whether it was approved.
   */
  @Remote('approve')
  async approve(proposalId: string): Promise<CrewImproveResult> {
    return this.change((file): CrewImproveResult => {
      for (const [member, record] of Object.entries(file.members)) {
        const proposal = record.proposals.find(entry => entry.id === proposalId)
        if (proposal === undefined) continue
        const kept = record.lessons.filter(lesson => lesson.id !== proposal.replaces)
        if (kept.length >= this.config.maxLessonsPerMember) {
          return { ok: false, message: `${member} already has ${String(kept.length)} lessons; remove one first` }
        }
        record.proposals = record.proposals.filter(entry => entry.id !== proposalId)
        record.lessons = [...kept, {
          id: proposal.id, member, text: proposal.text, evidence: proposal.evidence, sessionId: proposal.sessionId,
          proposedAt: proposal.proposedAt, approvedAt: new Date().toISOString(),
        }]
        return { ok: true }
      }
      return { ok: false, message: 'that proposal no longer exists' }
    })
  }

  /**
   * Reject a proposal; the same lesson is not proposed again.
   * @param proposalId - proposal to reject.
   * @returns whether it was rejected.
   */
  @Remote('reject')
  async reject(proposalId: string): Promise<CrewImproveResult> {
    return this.change((file): CrewImproveResult => {
      for (const record of Object.values(file.members)) {
        const proposal = record.proposals.find(entry => entry.id === proposalId)
        if (proposal === undefined) continue
        record.proposals = record.proposals.filter(entry => entry.id !== proposalId)
        record.rejected = [...new Set([...record.rejected, lessonKey(proposal.text)])]
        return { ok: true }
      }
      return { ok: false, message: 'that proposal no longer exists' }
    })
  }

  /**
   * Remove an approved lesson; it is not proposed again.
   * @param lessonId - lesson to remove.
   * @returns whether it was removed.
   */
  @Remote('forget')
  async forget(lessonId: string): Promise<CrewImproveResult> {
    return this.change((file): CrewImproveResult => {
      for (const record of Object.values(file.members)) {
        const lesson = record.lessons.find(entry => entry.id === lessonId)
        if (lesson === undefined) continue
        record.lessons = record.lessons.filter(entry => entry.id !== lessonId)
        record.rejected = [...new Set([...record.rejected, lessonKey(lesson.text)])]
        return { ok: true }
      }
      return { ok: false, message: 'that lesson no longer exists' }
    })
  }
}

export default CrewImprove
