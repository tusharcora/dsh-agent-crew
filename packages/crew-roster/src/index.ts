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
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-subagent'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { BUDGET_EXEMPT, budgetRefusal, capAbilities, idFor, MAX_MEMBERS, memberProblems, presetFor } from './compose.ts'
import { CONNECTIONS, DEFAULT_MEMBERS, FACE_COLORS, SUPERSEDED_PERSONAS } from './defaults.ts'
import type { CrewMember, RosterResult, RosterState } from './types.ts'

export type * from './types.ts'
export { ASK_TOOL, BUDGET_EXEMPT, budgetRefusal, capAbilities, MAX_TOOL_CALLS, idFor, MAX_DEPTH, MAX_MEMBERS, MEMBER_ID, memberProblems, presetFor } from './compose.ts'
export { CONNECTIONS, DEFAULT_MEMBERS, FACE_COLORS, SUPERSEDED_PERSONAS, type PluginRow } from './defaults.ts'

/** Model-facing tool that adds a crew member. */
export const CREATE_TOOL = 'crew_member_create'

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
  /** Shipped member ids this file has been offered; a shipped member the user removed is not added back. */
  readonly shipped: readonly string[]
}

/** What `read` found. */
interface StoredRoster {
  readonly members: readonly CrewMember[]
  readonly shipped: readonly string[]
  readonly fromFile: boolean
}

/** The shipped members a file without a `shipped` list was seeded with. */
const FIRST_SHIPPED: readonly string[] = ['crew-chief', 'crew-mail', 'crew-chat', 'crew-code', 'crew-research', 'crew-life']

function isMemberList(value: unknown): value is CrewMember[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'string')
}

/**
 * Bring stored records up to date: a shipped member whose instructions are an earlier shipped text gets the current
 * text, and a shipped member the file was never offered joins the crew.
 * @param members - stored records.
 * @param offered - shipped member ids the file was already offered.
 * @returns the records; the same array when nothing changed.
 */
export function migrate(members: readonly CrewMember[], offered: readonly string[] = FIRST_SHIPPED): readonly CrewMember[] {
  let changed = false
  const fresh = DEFAULT_MEMBERS.filter(member => !offered.includes(member.id) && !members.some(entry => entry.id === member.id))
  if (fresh.length > 0) changed = true
  const next = [...members, ...fresh].map((member) => {
    const current = DEFAULT_MEMBERS.find(entry => entry.id === member.id)
    if (member.builtIn !== true || current === undefined || !(SUPERSEDED_PERSONAS[member.id] ?? []).includes(member.persona)) return member
    changed = true
    return { ...member, persona: current.persona }
  })
  return changed ? next : members
}

function randomLetters(count: number): string {
  return Array.from({ length: count }, () => String.fromCharCode(97 + randomInt(26))).join('')
}

/** Stores the crew and keeps one registered preset per member. */
export class CrewRosterService extends TypertRemoteService {
  static inject = ['agentPresets', 'tools']
  static Config = Config
  private members: readonly CrewMember[] = []
  private writes: Promise<unknown> = Promise.resolve()
  private readonly registered = new Map<string, () => Promise<void>>()
  /** Tool calls made so far in the current turn, by Session id; only Sessions of budgeted members are counted. */
  private readonly calls = new Map<string, number>()

  /**
   * @param ctx - owning plugin context.
   * @param config - plugin config.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewRoster')
  }

  protected async [Service.init](): Promise<void> {
    const stored = await this.read()
    this.members = migrate(stored.members, stored.shipped)
    if (stored.fromFile && (this.members !== stored.members || DEFAULT_MEMBERS.some(member => !stored.shipped.includes(member.id)))) {
      await this.write(this.members)
    }
    this.ctx.effect(() => async () => {
      await this.writes
      for (const dispose of this.registered.values()) await dispose()
      this.registered.clear()
    }, 'crew-roster.presets')
    await this.register()
    this.ctx.effect(() => this.ctx.tools.register(this.createTool()), 'crew-roster.create-tool')
    this.ctx.on('session/event', (session, event) => { if (event.type === 'turn/start') this.calls.delete(session.id) })
    this.ctx.on('session/disposed', (session) => { this.calls.delete(session.id) })
    this.ctx.on('tools/pre-execute', async (exec, next) => this.overBudget(exec) ?? await next())
  }

  private get path(): string {
    return join(this.config.homeDirectory, 'members.json')
  }

  /**
   * The stored crew and the shipped ids it was offered; the shipped crew, saved, when there is no file yet. `fromFile` is
   * false when the file could not be used, so nothing overwrites it.
   */
  private async read(): Promise<StoredRoster> {
    const shippedIds = DEFAULT_MEMBERS.map(member => member.id)
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
      const record = typeof parsed === 'object' && parsed !== null ? parsed as { members?: unknown; shipped?: unknown } : {}
      const shipped = Array.isArray(record.shipped) ? record.shipped.filter(id => typeof id === 'string') : FIRST_SHIPPED
      if (isMemberList(record.members)) return { members: record.members, shipped, fromFile: true }
      this.ctx.logger.warn(`crew-roster: ${this.path} has no member list; using the shipped crew without overwriting it`)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.write(DEFAULT_MEMBERS)
        return { members: DEFAULT_MEMBERS, shipped: shippedIds, fromFile: false }
      }
      this.ctx.logger.warn(`crew-roster: ${this.path} unreadable, using the shipped crew without overwriting it: ${String(error)}`)
    }
    return { members: DEFAULT_MEMBERS, shipped: shippedIds, fromFile: false }
  }

  private write(members: readonly CrewMember[]): Promise<void> {
    const file: StoreFile = { version: 1, members, shipped: DEFAULT_MEMBERS.map(member => member.id) }
    return writeFileAtomic(this.path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
  }

  /**
   * Re-register every member's preset from the current roster; each lists its teammates, so any change touches all of
   * them. A member no longer on the roster only loses its preset. Chats already running keep the preset they started with.
   */
  private async register(): Promise<void> {
    for (const dispose of this.registered.values()) await dispose()
    this.registered.clear()
    for (const member of this.members) {
      try {
        this.registered.set(member.id, await this.ctx.agentPresets.register(presetFor(member, this.members)))
      } catch (error: unknown) {
        this.ctx.logger.warn(`crew-roster: preset ${member.id} not registered: ${String(error)}`)
      }
    }
  }

  /** Apply one change: save the new roster, then re-register the presets it touches; a failed save changes nothing. */
  private change(next: readonly CrewMember[]): Promise<void> {
    const result = this.writes.then(async () => {
      await this.write(next)
      this.members = next
      await this.register()
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
  saveMember(member: CrewMember): Promise<RosterResult<CrewMember>> {
    return this.put(member)
  }

  /** Add or update a member; `createdBy` marks a new member an agent created. */
  private async put(member: CrewMember, createdBy?: string): Promise<RosterResult<CrewMember>> {
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
    const { lead: _lead, builtIn: _builtIn, createdBy: _createdBy, ...edited } = member
    const creator = stored === undefined ? createdBy : stored.createdBy
    const saved: CrewMember = {
      ...edited, id, name: member.name.trim(), description: member.description.trim(),
      connections: [...new Set(member.connections)],
      order: stored?.order ?? Math.max(19, ...this.members.map(entry => entry.order)) + 1,
      ...stored?.lead === true ? { lead: true } : {}, ...stored?.builtIn === true ? { builtIn: true } : {},
      ...creator === undefined ? {} : { createdBy: creator },
    }
    const problems = memberProblems(saved)
    if (problems.length > 0) return { ok: false, message: problems.join(' ') }
    const next = stored === undefined ? [...this.members, saved] : this.members.map(entry => entry.id === id ? saved : entry)
    await this.change(next)
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
    await this.change(this.members.filter(entry => entry.id !== id))
    return { ok: true, value: true }
  }

  /**
   * Count a call against its member's budget for the current message; refuse it once the budget is used up. Calls
   * nested in `run_code` count too, so the budget measures work rather than model steps.
   */
  private overBudget(exec: ToolExecution): PreToolDecision | undefined {
    const member = this.memberOf(exec.agent)
    const limit = member?.maxToolCalls ?? 0
    if (member === undefined || exec.agent === undefined || limit === 0 || BUDGET_EXEMPT.has(exec.name)) return undefined
    const used = (this.calls.get(exec.agent.session.id) ?? 0) + 1
    this.calls.set(exec.agent.session.id, used)
    return used > limit ? { kind: 'deny', reason: budgetRefusal(member, limit) } : undefined
  }

  /** The member a Session runs as, when it runs a crew preset. */
  private memberOf(agent: Agent | undefined): CrewMember | undefined {
    const preset = agent === undefined ? null : this.ctx.agentPresets.presetForSession(agent.session)
    return this.members.find(member => member.id === preset)
  }

  private createTool() {
    return defineTool({
      name: CREATE_TOOL,
      description: 'Add a crew member when recurring work fits no teammate. It joins the crew at once, appears in the user\'s Crew tab, '
        + 'where the user can edit or remove it, and can be asked with ask_crew from the user\'s next chats. Its abilities and '
        + 'connections are limited to ones some member already has. Pass first_task to start it on a task now and get its answer.',
      parameters: {
        name: { type: 'string', required: true, description: 'Short name, such as Designer.' },
        description: { type: 'string', required: true, description: 'One line on what it does; teammates read it when choosing whom to ask.' },
        instructions: { type: 'string', required: true, description: 'How it works and what it must never do; opens its system prompt.' },
        files: { type: 'string', enum: ['none', 'read', 'write'] as const, description: 'File access; defaults to none.' },
        shell: { type: 'boolean', description: 'Run commands.' },
        web: { type: 'boolean', description: 'Fetch web pages; defaults to true.' },
        schedule: { type: 'boolean', description: 'Create scheduled tasks.' },
        connections: { type: 'array', items: { type: 'string' }, description: `Services: ${CONNECTIONS.map(entry => entry.id).join(', ')}.` },
        first_task: { type: 'string', description: 'A self-contained task to start the new member on now.' },
        max_tool_calls: { type: 'number', description: 'Most tool calls it may make per message; omit or 0 for no limit.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { summary: { type: 'string', required: true } } },
        render: (_args, value) => [{ type: 'text', text: value.summary }],
      },
      execute: async (args, exec) => {
        const caller = this.memberOf(exec.agent)
        const requested = {
          abilities: { files: args.files ?? 'none', shell: args.shell === true, web: args.web !== false, schedule: args.schedule === true },
          connections: args.connections ?? [],
        } as const
        const granted = capAbilities(requested, this.members)
        const used = new Set(this.members.map(member => member.face.color.toLowerCase()))
        const color = FACE_COLORS.find(entry => !used.has(entry.toLowerCase())) ?? FACE_COLORS[0] ?? '#4D6BFE'
        const bodies = ['orb', 'block', 'drop', 'bean'] as const
        const result = await this.put({
          id: '', name: args.name, description: args.description, persona: args.instructions, order: 0,
          face: { body: bodies[this.members.length % bodies.length] ?? 'orb', color },
          abilities: granted.abilities, connections: granted.connections,
          ...args.max_tool_calls === undefined || args.max_tool_calls === 0 ? {} : { maxToolCalls: args.max_tool_calls },
        }, caller?.id ?? 'agent')
        if (!result.ok) return { summary: `No member was added: ${result.message}` }
        const member = result.value
        const limits = granted.dropped.length === 0 ? '' : ` Not granted, because no member has it: ${granted.dropped.join(', ')}.`
        const added = `Added ${member.name} as ${member.id}.${limits}`
        const subagents = this.ctx.get('subagents')
        if (args.first_task === undefined || args.first_task.trim() === '' || exec.agent === undefined || subagents === undefined) {
          return { summary: `${added} Ask it with ask_crew and agent_preset ${member.id} in a new chat.` }
        }
        const activation = await subagents.startActivation({
          provider: 'spawn', label: member.name, prompt: [{ type: 'text', text: args.first_task }], parent: exec.agent,
          agentPreset: member.id, delivery: 'caller', signal: exec.signal,
        })
        const outcome = await activation.result
        const text = outcome.output.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n').trim()
        return {
          summary: outcome.stopReason === 'completed'
            ? `${added} Its answer to the first task:\n${text}`
            : `${added} Its first task stopped (${outcome.stopReason}): ${outcome.diagnostic ?? text}`,
        }
      },
    })
  }
}

export default CrewRosterService
