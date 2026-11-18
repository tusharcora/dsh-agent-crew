/** Check member records and turn each into the agent preset it runs as. */
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { CONNECTIONS, type PluginRow } from './defaults.ts'
import type { CrewMember, FileAccess, MemberAbilities, MemberBody, MemberTone } from './types.ts'

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
/** Longest backstory, in characters. */
export const MAX_BACKSTORY = 600

/** What each tone adds to a member's instructions. */
export const TONE_GUIDANCE: Readonly<Record<MemberTone, string>> = {
  plain: '',
  direct: '\nTone: direct. Lead with the answer, skip pleasantries and hedging, and say plainly when something is a bad idea.',
  witty: '\nTone: witty. Be warm and quick, with dry humour and an opinion when you have one, but never at the cost of '
    + 'accuracy or a clear answer. Keep jokes out of anything sent under the user\'s name.',
}

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
  if (member.tone !== undefined && !(member.tone in TONE_GUIDANCE)) problems.push('Choose a tone: plain, direct or witty.')
  if ((member.backstory?.length ?? 0) > MAX_BACKSTORY) problems.push(`Keep the backstory to ${String(MAX_BACKSTORY)} characters.`)
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

/** Added to every member that can use the web: current facts first, X included, each with a source and date. */
export const LIVE_GUIDANCE = '\nBefore answering anything that may have changed recently (news, prices, releases, people, events), '
  + 'search the web first, including recent posts on x.com, and give each source with its date. Say plainly when you could '
  + 'not confirm something.'

/** Added to members that touch files: their chat starts in their own folder, and every workspace is reachable from it. */
export const WORKSPACE_GUIDANCE = '\nYour chat starts in your own folder. To work on one of the user\'s projects, list them with '
  + 'crew_workspaces, then read files there by path or enter one with working_directory. Changes outside your own folder '
  + 'ask the user first.'

/** Added to the lead: how to run an errand, a chat with a goal that continues on its own until done or blocked. */
export const ERRAND_GUIDANCE = '\nErrands: when this chat has a goal, work toward it without waiting for the user. Plan the steps, hand them '
  + `to teammates with ${ASK_TOOL}, and keep going round after round. Get the user's approval before anything irreversible, `
  + 'and ask with ask_user when you need a decision. When the goal is met, complete it with a short summary of what was done '
  + 'and what is left for the user. If you cannot go on without the user, block it and say exactly what you need.'

/** Added to the lead: ask several teammates the same hard question at once and combine their answers. */
export const HEAVY_GUIDANCE = `\nHeavy mode: for a hard, open-ended or high-stakes question, or whenever the user says "heavy", call ${ASK_TOOL} `
  + 'several times in the same step, giving the same question to the two to four teammates best suited to it; those calls '
  + 'run in parallel. Then compare the answers, say where they agree and where they differ, and give one combined answer.'

/** The member's backstory and tone, as lines after its instructions. */
const character = (member: CrewMember): string => {
  const backstory = member.backstory?.trim() ?? ''
  return `${backstory === '' ? '' : `\nYour character: ${backstory}`}${TONE_GUIDANCE[member.tone ?? 'plain']}`
}

const row = (id: string, name: string, config?: Record<string, unknown>, disabled?: boolean): PluginRow =>
  ({ id, name, ...config === undefined ? {} : { config }, ...disabled === undefined ? {} : { disabled } })

/**
 * The preset a member runs as. Every member gets the time, run_code, write guard, lessons, skill, ask-user and todo rows,
 * the subagent control tools, one `ask_crew` tool that can start any teammate, and a list of its teammates in its instructions.
 * @param member - the member.
 * @param crew - the whole roster, read for the teammates.
 * @param platform - Host platform, which picks bash or PowerShell.
 * @param credentials - whether a credentials provider exists; without one, connections that read the credential store stay off.
 * @returns the preset definition.
 */
export function presetFor(
  member: CrewMember, crew: readonly CrewMember[], platform: NodeJS.Platform = process.platform, credentials = true,
): PresetDefinition {
  const others = crew.filter(entry => entry.id !== member.id)
  const roster = others.length > 0
    ? `\nYour teammates. Hand one a self-contained task with ${ASK_TOOL}, passing its id as agent_preset:\n`
      + others.map(entry => `- ${entry.id} (${entry.name}): ${entry.description}`).join('\n')
    : ''
  const { files, shell, web, schedule } = member.abilities
  const local = files !== 'none' || shell
  const guidance = [
    web ? LIVE_GUIDANCE : '', local ? WORKSPACE_GUIDANCE : '', member.lead === true && others.length > 1 ? HEAVY_GUIDANCE : '',
    member.lead === true ? ERRAND_GUIDANCE : '',
  ].join('')
  const plugins: PluginRow[] = [
    row('persona', '@deepseek-ai/dsh-persona', { prefix: `${member.persona.trim()}${character(member)}${guidance}${roster}\n` }),
    ...shell ? [row('agent-instructions', '@deepseek-ai/dsh-agent-instructions', { maxBytes: 65536 })] : [],
    row('time-context', '@deepseek-ai/dsh-time-context'),
    row('tool-executor-ptc', '@deepseek-ai/dsh-tool-executor-ptc'),
    row('crew-write-guard', '@deepseek-ai/dsh-crew-connections/guard'),
    row('crew-lessons', '@deepseek-ai/dsh-crew-improve/lessons', { member: member.id }),
    // A connection whose account is not approved yet keeps its row, switched off.
    ...member.connections.flatMap((id) => {
      const entry = CONNECTIONS.find(candidate => candidate.id === id)
      // Off without a credentials provider too: the MCP client refuses credential templates then, and the refusal would
      // stop the member's agent from starting at all.
      const usable = entry !== undefined && entry.available && (credentials || entry.row.config?.['expandTemplates'] !== true)
      return entry === undefined ? [] : [usable ? entry.row : { ...entry.row, disabled: true }]
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
    ...local ? [row('tool-working-directory', '@deepseek-ai/dsh-tool-working-directory')] : [],
    ...web ? [row('tool-web', '@deepseek-ai/dsh-tool-web', { fetch: true })] : [],
    ...schedule ? [row('tool-schedule', '@deepseek-ai/dsh-tool-schedule')] : [],
    // Presets own the skill tool in the web app; without it a member sees no skills, the host's included.
    row('tool-skill', '@deepseek-ai/dsh-tool-skill'),
    row('tool-ask-user', '@deepseek-ai/dsh-tool-ask-user'),
    row('tool-todo', '@deepseek-ai/dsh-tool-todo', { allowParallelInProgress: true }),
    // The lead runs errands: the goal tool lets it complete or block the goal its chat was given.
    ...member.lead === true ? [row('tool-goal', '@deepseek-ai/dsh-tool-goal')] : [],
    ...others.length > 0 ? [
      row('tool-subagent-control', '@deepseek-ai/dsh-tool-subagent-control'),
      row('ask-crew', '@deepseek-ai/dsh-tool-subagent', {
        provider: 'spawn', toolName: ASK_TOOL, allowedAgentPresets: others.map(entry => entry.id), maxDepth: MAX_DEPTH,
      }),
    ] : [],
  ]
  return { id: member.id, name: member.name, description: member.description, order: member.order, plugins }
}
