/** Check member records and turn each into the agent preset it runs as. */
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { CONNECTIONS, type PluginRow } from './defaults.ts'
import type { CrewMember, FileAccess, MemberAbilities, MemberBody } from './types.ts'

/** Member ids: `crew-` and lowercase letters, the form crew-improve, crew-connections and crew-workflows accept. */
export const MEMBER_ID = /^crew-[a-z]+$/

/** Highest tool-call budget a member may have; a larger need is better served by no limit. */
export const MAX_TOOL_CALLS = 1000

/** Tools a member may still call after its budget is used up: asking the user is how it reports being stuck. */
export const BUDGET_EXEMPT: ReadonlySet<string> = new Set(['ask_user_question'])

/**
 * The refusal a member reads once its budget for the message is used up.
 * @param member - the member.
 * @param limit - its budget.
 * @returns the refusal.
 */
export function budgetRefusal(member: Pick<CrewMember, 'name'>, limit: number): string {
  return `${member.name} has used its budget of ${String(limit)} tool calls for this message. Stop calling tools and answer now `
    + 'with what you have, saying what is left undone.'
}

/** Most members one crew may have. */
export const MAX_MEMBERS = 16

const BODIES: readonly MemberBody[] = ['orb', 'block', 'drop', 'bean']
const COLOR = /^#[0-9a-fA-F]{6}$/
const MAX_PERSONA = 8000

/**
 * A new member's id from its name: `crew-` and the name's ASCII letters, or `fallback` when it has none.
 * @param name - the member's name.
 * @param fallback - letters to use when the name has none.
 * @returns the id.
 */
export function idFor(name: string, fallback: string): string {
  const letters = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 24)
  return `crew-${letters === '' ? fallback : letters}`
}

/**
 * Problems with a member record, in the words the editor shows.
 * @param member - candidate record.
 * @returns problems; empty when it can be saved.
 */
export function memberProblems(member: CrewMember): readonly string[] {
  const problems: string[] = []
  if (!MEMBER_ID.test(member.id)) problems.push(`"${member.id}" is not a crew member id.`)
  if (member.name.trim() === '' || member.name.length > 40) problems.push('Give the member a name of up to 40 characters.')
  if (member.description.length > 200) problems.push('Keep the description to 200 characters.')
  if (member.persona.trim() === '') problems.push('Write the member\'s instructions.')
  if (member.persona.length > MAX_PERSONA) problems.push(`Keep the instructions to ${String(MAX_PERSONA)} characters.`)
  if (!BODIES.includes(member.face.body)) problems.push('Choose a face shape.')
  if (!COLOR.test(member.face.color)) problems.push('Choose a face colour.')
  if (!['none', 'read', 'write'].includes(member.abilities.files)) problems.push('Choose how the member may use files.')
  const budget = member.maxToolCalls
  if (budget !== undefined && (!Number.isInteger(budget) || budget < 0 || budget > MAX_TOOL_CALLS)) {
    problems.push(`Set a tool-call budget from 0 (no limit) to ${String(MAX_TOOL_CALLS)}.`)
  }
  const unknown = member.connections.filter(id => !CONNECTIONS.some(entry => entry.id === id))
  if (unknown.length > 0) problems.push(`Unknown connections: ${unknown.join(', ')}.`)
  return problems
}

/** The one delegation tool every member uses to hand work to a teammate. */
export const ASK_TOOL = 'ask_crew'

/** Delegation depth from the chat the user started: a member asks a teammate, who may ask one more. */
export const MAX_DEPTH = 2

const FILE_RANK: readonly FileAccess[] = ['none', 'read', 'write']

/**
 * Limit abilities and connections an agent asks for to the ones some member already has, so an agent cannot give a new
 * member a power the crew lacks. Connections whose account is not approved yet are never granted.
 * @param requested - what the agent asked for.
 * @param crew - the current members.
 * @returns what is granted, and the names of what was not.
 */
export function capAbilities(
  requested: Pick<CrewMember, 'abilities' | 'connections'>, crew: readonly CrewMember[],
): { readonly abilities: MemberAbilities; readonly connections: readonly string[]; readonly dropped: readonly string[] } {
  const rank = Math.max(0, ...crew.map(member => FILE_RANK.indexOf(member.abilities.files)))
  const has = (key: 'shell' | 'web' | 'schedule') => crew.some(member => member.abilities[key])
  const files = FILE_RANK[Math.min(FILE_RANK.indexOf(requested.abilities.files), rank)] ?? 'none'
  const abilities: MemberAbilities = {
    files, shell: requested.abilities.shell && has('shell'), web: requested.abilities.web && has('web'),
    schedule: requested.abilities.schedule && has('schedule'),
  }
  const held = new Set(crew.flatMap(member => member.connections))
  const connections = requested.connections.filter(id => held.has(id) && CONNECTIONS.some(entry => entry.id === id && entry.available))
  const dropped = [
    ...files === requested.abilities.files ? [] : [`files: ${requested.abilities.files}`],
    ...(['shell', 'web', 'schedule'] as const).filter(key => requested.abilities[key] && !abilities[key]),
    ...requested.connections.filter(id => !connections.includes(id)),
  ]
  return { abilities, connections, dropped }
}

const row = (id: string, name: string, config?: Record<string, unknown>, disabled?: boolean): PluginRow =>
  ({ id, name, ...config === undefined ? {} : { config }, ...disabled === undefined ? {} : { disabled } })

/**
 * The preset a member runs as. Every member gets the time, run_code, write guard, lessons, skill, ask-user and todo rows,
 * the subagent control tools, one `ask_crew` tool that can start any teammate, and a list of its teammates in its instructions.
 * @param member - the member.
 * @param crew - the whole roster, read for the teammates.
 * @param platform - Host platform, which picks bash or PowerShell.
 * @returns the preset definition.
 */
export function presetFor(member: CrewMember, crew: readonly CrewMember[], platform: NodeJS.Platform = process.platform): PresetDefinition {
  const others = crew.filter(entry => entry.id !== member.id)
  const roster = others.length > 0
    ? `\nYour teammates. Hand one a self-contained task with ${ASK_TOOL}, passing its id as agent_preset:\n`
      + others.map(entry => `- ${entry.id} (${entry.name}): ${entry.description}`).join('\n')
    : ''
  const { files, shell, web, schedule } = member.abilities
  const plugins: PluginRow[] = [
    row('persona', '@deepseek-ai/dsh-persona', { prefix: `${member.persona.trim()}${roster}\n` }),
    ...shell ? [row('agent-instructions', '@deepseek-ai/dsh-agent-instructions', { maxBytes: 65536 })] : [],
    row('time-context', '@deepseek-ai/dsh-time-context'),
    row('tool-executor-ptc', '@deepseek-ai/dsh-tool-executor-ptc'),
    row('crew-write-guard', '@deepseek-ai/dsh-crew-connections/guard'),
    row('crew-lessons', '@deepseek-ai/dsh-crew-improve/lessons', { member: member.id }),
    // A connection whose account is not approved yet keeps its row, switched off.
    ...member.connections.flatMap((id) => {
      const entry = CONNECTIONS.find(candidate => candidate.id === id)
      return entry === undefined ? [] : [entry.available ? entry.row : { ...entry.row, disabled: true }]
    }),
    ...shell ? [
      row('tool-bash', '@deepseek-ai/dsh-tool-bash', undefined, platform === 'win32'),
      row('tool-pwsh', '@deepseek-ai/dsh-tool-pwsh', undefined, platform !== 'win32'),
      row('tool-jobs', '@deepseek-ai/dsh-tool-jobs'),
    ] : [],
    ...files === 'none' ? [] : [
      row('tool-fs', '@deepseek-ai/dsh-tool-fs', files === 'read' ? { write: false, edit: false } : undefined),
      row('tool-fs-search', '@deepseek-ai/dsh-tool-fs-search', { sampleOverCapGlobResults: false }),
    ],
    ...web ? [row('tool-web', '@deepseek-ai/dsh-tool-web', { fetch: true })] : [],
    ...schedule ? [row('tool-schedule', '@deepseek-ai/dsh-tool-schedule')] : [],
    // Presets own the skill tool in the web app; without it a member sees no skills, the host's included.
    row('tool-skill', '@deepseek-ai/dsh-tool-skill'),
    row('tool-ask-user', '@deepseek-ai/dsh-tool-ask-user'),
    row('tool-todo', '@deepseek-ai/dsh-tool-todo', { allowParallelInProgress: true }),
    ...others.length > 0 ? [
      row('tool-subagent-control', '@deepseek-ai/dsh-tool-subagent-control'),
      row('ask-crew', '@deepseek-ai/dsh-tool-subagent', {
        provider: 'spawn', toolName: ASK_TOOL, allowedAgentPresets: others.map(entry => entry.id), maxDepth: MAX_DEPTH,
      }),
    ] : [],
  ]
  return { id: member.id, name: member.name, description: member.description, order: member.order, plugins }
}
