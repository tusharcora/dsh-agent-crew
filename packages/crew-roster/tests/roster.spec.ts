import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { afterEach, describe, expect, it } from 'vitest'
import CrewRoster, { askTool, DEFAULT_MEMBERS, idFor, memberProblems, presetFor, type CrewMember } from '../src/index.ts'

const helper: CrewMember = {
  id: 'crew-helper', name: 'Helper', description: 'Answers quick questions.', persona: 'You are Helper.', order: 30,
  face: { body: 'drop', color: '#123456' }, abilities: { files: 'read', shell: false, web: true, schedule: false }, connections: ['github'],
}

describe('idFor and memberProblems', () => {
  it('derives an id from the name letters, with a fallback', () => {
    expect(idFor('Data Wrangler 2', 'zz')).toBe('crew-datawrangler')
    expect(idFor('设计', 'abcdef')).toBe('crew-abcdef')
  })
  it('accepts the shipped crew and reports bad records', () => {
    for (const member of DEFAULT_MEMBERS) expect(memberProblems(member), member.id).toEqual([])
    const bad = { ...helper, id: 'helper', name: '', persona: ' ', face: { body: 'cube', color: 'red' }, connections: ['nope'] } as never as CrewMember
    expect(memberProblems(bad)).toHaveLength(6)
  })
})

describe('presetFor', () => {
  const rows = (preset: PresetDefinition) => preset.plugins.map(row => row.name)
  it('gives a member the tools its abilities name and its connections', () => {
    const preset = presetFor(helper, [...DEFAULT_MEMBERS, helper], 'darwin')
    expect(preset).toMatchObject({ id: 'crew-helper', name: 'Helper', order: 30 })
    expect(rows(preset)).toContain('@deepseek-ai/dsh-tool-web')
    expect(rows(preset)).not.toContain('@deepseek-ai/dsh-tool-bash')
    expect(preset.plugins.find(row => row.name === '@deepseek-ai/dsh-tool-fs')?.config).toEqual({ write: false, edit: false })
    expect(preset.plugins.find(row => row.id === 'mcp-github')?.config).toMatchObject({ serverName: 'github' })
    expect(preset.plugins.find(row => row.id === 'crew-lessons')?.config).toEqual({ member: 'crew-helper' })
  })
  it('switches the shell row by platform and keeps unapproved connections off', () => {
    const code = DEFAULT_MEMBERS.find(member => member.id === 'crew-code')!
    const mac = presetFor(code, DEFAULT_MEMBERS, 'darwin').plugins
    expect(mac.find(row => row.id === 'tool-bash')?.disabled).toBe(false)
    expect(mac.find(row => row.id === 'tool-pwsh')?.disabled).toBe(true)
    const chat = DEFAULT_MEMBERS.find(member => member.id === 'crew-chat')!
    expect(presetFor(chat, DEFAULT_MEMBERS).plugins.find(row => row.id === 'mcp-slack')?.disabled).toBe(true)
  })
  it('gives the lead one ask tool and one roster line per other member', () => {
    const chief = DEFAULT_MEMBERS[0]!
    const preset = presetFor(chief, [...DEFAULT_MEMBERS, helper])
    const asks = preset.plugins.filter(row => row.name === '@deepseek-ai/dsh-tool-subagent').map(row => row.config as Record<string, unknown> | undefined)
    expect(asks.map(config => config?.['toolName'])).toEqual(['ask_mail', 'ask_chat', 'ask_code', 'ask_research', 'ask_life', 'ask_helper'])
    expect(asks.every(config => config?.['provider'] === 'spawn' && typeof config['agentPreset'] === 'string')).toBe(true)
    expect(String((preset.plugins[0]?.config as Record<string, unknown> | undefined)?.['prefix'])).toContain(`- ${askTool(helper)}: Helper. Answers quick questions.`)
  })
})

describe('CrewRosterService', () => {
  let home: string | undefined
  afterEach(async () => { if (home !== undefined) await rm(home, { recursive: true, force: true }) })

  async function boot(file?: string) {
    home = await mkdtemp(join(tmpdir(), 'crew-roster-'))
    if (file !== undefined) await writeFile(join(home, 'members.json'), file)
    const live = new Map<string, PresetDefinition>()
    const ctx = new Context()
    ctx.provide('agentPresets', {
      register: (definition: PresetDefinition) => {
        if (live.has(definition.id)) return Promise.reject(new Error(`Duplicate agent preset: ${definition.id}`))
        live.set(definition.id, definition)
        return Promise.resolve(() => { live.delete(definition.id); return Promise.resolve() })
      },
    } as never)
    await ctx.plugin(CrewRoster, { homeDirectory: home })
    const roster = await new Promise<CrewRoster>((resolve) => { ctx.inject(['crewRoster'], (inner) => { resolve(inner.crewRoster) }) })
    return { roster, live, home }
  }

  it('seeds and registers the shipped crew on first run', async () => {
    const { roster, live, home: dir } = await boot()
    expect([...live.keys()]).toEqual(DEFAULT_MEMBERS.map(member => member.id))
    expect((await roster.state()).members).toHaveLength(6)
    expect(JSON.parse(await readFile(join(dir, 'members.json'), 'utf8'))).toMatchObject({ version: 1, members: DEFAULT_MEMBERS })
  })

  it('adds, edits and removes a member and keeps the lead in step', async () => {
    const { roster, live } = await boot()
    const added = await roster.saveMember({ ...helper, id: '', lead: true, builtIn: true })
    expect(added).toMatchObject({ ok: true, value: { id: 'crew-helper', order: 26 } })
    if (!added.ok) return
    expect(added.value.lead).toBeUndefined()
    expect(live.get('crew-helper')?.name).toBe('Helper')
    expect(JSON.stringify(live.get('crew-chief'))).toContain('ask_helper')
    expect(await roster.saveMember({ ...helper, id: '' })).toMatchObject({ ok: false })
    expect(await roster.saveMember({ ...added.value, name: 'Helpful' })).toMatchObject({ ok: true, value: { id: 'crew-helper', name: 'Helpful' } })
    expect(live.get('crew-helper')?.name).toBe('Helpful')
    expect(await roster.saveMember({ ...added.value, persona: '' })).toMatchObject({ ok: false, message: 'Write the member\'s instructions.' })
    expect(await roster.deleteMember('crew-helper')).toEqual({ ok: true, value: true })
    expect(live.has('crew-helper')).toBe(false)
    expect(JSON.stringify(live.get('crew-chief'))).not.toContain('ask_helper')
  })

  it('refuses to remove the lead or a missing member', async () => {
    const { roster, live } = await boot()
    expect(await roster.deleteMember('crew-chief')).toMatchObject({ ok: false })
    expect(await roster.deleteMember('crew-nobody')).toMatchObject({ ok: false })
    expect(live.has('crew-chief')).toBe(true)
  })

  it('keeps an unreadable file and runs the shipped crew', async () => {
    const { live, home: dir } = await boot('{ not json')
    expect(live.size).toBe(6)
    expect(await readFile(join(dir, 'members.json'), 'utf8')).toBe('{ not json')
  })
})
