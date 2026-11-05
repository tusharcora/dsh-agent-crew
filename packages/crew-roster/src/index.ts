/**
 * Crew roster, Host half: the crew members, stored in `members.json` and registered as agent presets. The browser adds,
 * edits and removes members through the `crewRoster` Remote; the lead's delegation tools follow every change.
 * @module @deepseek-ai/dsh-crew-roster
 */
import { randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import { idFor, MAX_MEMBERS, memberProblems, presetFor } from './compose.ts'
import { CONNECTIONS, DEFAULT_MEMBERS } from './defaults.ts'
import type { CrewMember, RosterResult, RosterState } from './types.ts'

export type * from './types.ts'
export { askTool, idFor, MAX_MEMBERS, MEMBER_ID, memberProblems, presetFor } from './compose.ts'
export { CONNECTIONS, DEFAULT_MEMBERS, type PluginRow } from './defaults.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Crew members and the presets they run as. */
    crewRoster: CrewRosterService
  }
}

/** Plugin config. */
export interface Config {
  /** Folder holding `members.json`. */
  homeDirectory: string
}

/** Config schema. */
export const Config: z<Config> = z.object({
  homeDirectory: z.string().required().description('Folder holding members.json.'),
})

interface StoreFile {
  readonly version: 1
  readonly members: readonly CrewMember[]
}

function isMemberList(value: unknown): value is CrewMember[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string')
}

function randomLetters(count: number): string {
  return Array.from({ length: count }, () => String.fromCharCode(97 + randomInt(26))).join('')
}

/** Stores the crew and keeps one registered preset per member. */
export class CrewRosterService extends TypertRemoteService {
  static inject = ['agentPresets']
  static Config = Config
  private members: readonly CrewMember[] = []
  private writes: Promise<unknown> = Promise.resolve()
  private readonly registered = new Map<string, () => Promise<void>>()

  /**
   * @param ctx - owning plugin context.
   * @param config - plugin config.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewRoster')
  }

  protected async [Service.init](): Promise<void> {
    this.members = await this.read()
    this.ctx.effect(() => async () => {
      await this.writes
      for (const dispose of this.registered.values()) await dispose()
      this.registered.clear()
    }, 'crew-roster.presets')
    await this.register(this.members.map(member => member.id))
  }

  private get path(): string {
    return join(this.config.homeDirectory, 'members.json')
  }

  /** The stored crew; the shipped crew, saved, when there is no file yet. */
  private async read(): Promise<readonly CrewMember[]> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
      const members = typeof parsed === 'object' && parsed !== null ? (parsed as { members?: unknown }).members : undefined
      if (isMemberList(members)) return members
      this.ctx.logger.warn(`crew-roster: ${this.path} has no member list; using the shipped crew without overwriting it`)
      return DEFAULT_MEMBERS
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.ctx.logger.warn(`crew-roster: ${this.path} unreadable, using the shipped crew without overwriting it: ${String(error)}`)
        return DEFAULT_MEMBERS
      }
      await this.write(DEFAULT_MEMBERS)
      return DEFAULT_MEMBERS
    }
  }

  private write(members: readonly CrewMember[]): Promise<void> {
    const file: StoreFile = { version: 1, members }
    return writeFileAtomic(this.path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
  }

  /**
   * Re-register the named members' presets, and the lead's, from the current roster. A member no longer on the roster
   * only loses its preset. Chats already running keep the preset they started with.
   */
  private async register(ids: readonly string[]): Promise<void> {
    const lead = this.members.find(member => member.lead === true)
    const touched = new Set([...ids, ...lead === undefined ? [] : [lead.id]])
    for (const id of touched) {
      await this.registered.get(id)?.()
      this.registered.delete(id)
    }
    for (const member of this.members.filter(entry => touched.has(entry.id))) {
      try {
        this.registered.set(member.id, await this.ctx.agentPresets.register(presetFor(member, this.members)))
      } catch (error: unknown) {
        this.ctx.logger.warn(`crew-roster: preset ${member.id} not registered: ${String(error)}`)
      }
    }
  }

  /** Apply one change: save the new roster, then re-register the presets it touches; a failed save changes nothing. */
  private change(next: readonly CrewMember[], touched: readonly string[]): Promise<void> {
    const result = this.writes.then(async () => {
      await this.write(next)
      this.members = next
      await this.register(touched)
    })
    this.writes = result.catch(() => undefined)
    return result
  }

  /**
   * The crew and the services members can connect to.
   * @returns the roster state.
   */
  @Remote('state')
  state(): Promise<RosterState> {
    const connections = CONNECTIONS.map(({ id, label, available }) => ({ id, label, available }))
    return Promise.resolve({ members: this.members, connections })
  }

  /**
   * Add a member (an empty id) or update one. The id, lead mark, shipped mark and order stay as stored.
   * @param member - the edited member.
   * @returns the saved member, or why it cannot be saved.
   */
  @Remote('saveMember')
  async saveMember(member: CrewMember): Promise<RosterResult<CrewMember>> {
    await this.writes
    const stored = this.members.find(entry => entry.id === member.id)
    if (member.id !== '' && stored === undefined) return { ok: false, message: 'That crew member no longer exists.' }
    if (stored === undefined && this.members.length >= MAX_MEMBERS) {
      return { ok: false, message: `A crew can have at most ${String(MAX_MEMBERS)} members.` }
    }
    const id = stored?.id ?? idFor(member.name, randomLetters(6))
    if (stored === undefined && this.members.some(entry => entry.id === id)) {
      return { ok: false, message: `Another crew member already uses the id ${id}; choose a different name.` }
    }
    const { lead: _lead, builtIn: _builtIn, ...edited } = member
    const saved: CrewMember = {
      ...edited, id, name: member.name.trim(), description: member.description.trim(),
      connections: [...new Set(member.connections)],
      order: stored?.order ?? Math.max(19, ...this.members.map(entry => entry.order)) + 1,
      ...stored?.lead === true ? { lead: true } : {}, ...stored?.builtIn === true ? { builtIn: true } : {},
    }
    const problems = memberProblems(saved)
    if (problems.length > 0) return { ok: false, message: problems.join(' ') }
    const next = stored === undefined ? [...this.members, saved] : this.members.map(entry => entry.id === id ? saved : entry)
    await this.change(next, [id])
    return { ok: true, value: saved }
  }

  /**
   * Remove a member. Its past chats stay; they cannot start new turns once dsh restarts.
   * @param id - member id.
   * @returns success, or why it cannot be removed.
   */
  @Remote('deleteMember')
  async deleteMember(id: string): Promise<RosterResult> {
    await this.writes
    const stored = this.members.find(entry => entry.id === id)
    if (stored === undefined) return { ok: false, message: 'That crew member no longer exists.' }
    if (stored.lead === true) return { ok: false, message: `${stored.name} leads the crew and cannot be removed.` }
    await this.change(this.members.filter(entry => entry.id !== id), [id])
    return { ok: true, value: true }
  }
}

export default CrewRosterService
