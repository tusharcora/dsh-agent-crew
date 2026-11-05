/** Check member records and turn each into the agent preset it runs as. */
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { CONNECTIONS, type PluginRow } from './defaults.ts'
import type { CrewMember, MemberBody } from './types.ts'

/** Member ids: `crew-` and lowercase letters, the form crew-improve, crew-connections and crew-workflows accept. */
export const MEMBER_ID = /^crew-[a-z]+$/

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
  const unknown = member.connections.filter(id => !CONNECTIONS.some(entry => entry.id === id))
  if (unknown.length > 0) problems.push(`Unknown connections: ${unknown.join(', ')}.`)
  return problems
}

/**
 * The delegation tool name the lead calls a member by.
 * @param member - a non-lead member.
 * @returns `ask_` and the id's letters.
 */
export function askTool(member: Pick<CrewMember, 'id'>): string {
  return `ask_${member.id.slice('crew-'.length)}`
}

const row = (id: string, name: string, config?: Record<string, unknown>, disabled?: boolean): PluginRow =>
  ({ id, name, ...config === undefined ? {} : { config }, ...disabled === undefined ? {} : { disabled } })

/**
 * The preset a member runs as. Every member gets the time, run_code, write guard, lessons, ask-user and todo rows; the
 * lead also gets one delegation tool per other member and a list of them in its instructions.
 * @param member - the member.
 * @param crew - the whole roster, read for the lead's delegation tools.
 * @param platform - Host platform, which picks bash or PowerShell.
 * @returns the preset definition.
 */
export function presetFor(member: CrewMember, crew: readonly CrewMember[], platform: NodeJS.Platform = process.platform): PresetDefinition {
  const others = crew.filter(entry => entry.id !== member.id && entry.lead !== true)
  const roster = member.lead === true && others.length > 0
    ? `\nYour crew, and the tool that asks each one:\n${others.map(entry => `- ${askTool(entry)}: ${entry.name}. ${entry.description}`).join('\n')}`
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
    row('tool-ask-user', '@deepseek-ai/dsh-tool-ask-user'),
    row('tool-todo', '@deepseek-ai/dsh-tool-todo', { allowParallelInProgress: true }),
    ...member.lead === true ? [
      row('tool-subagent-control', '@deepseek-ai/dsh-tool-subagent-control'),
      ...others.map(entry => row(`ask-${entry.id.slice('crew-'.length)}`, '@deepseek-ai/dsh-tool-subagent', {
        provider: 'spawn', toolName: askTool(entry), agentPreset: entry.id,
      })),
    ] : [],
  ]
  return { id: member.id, name: member.name, description: member.description, order: member.order, plugins }
}
