import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { afterEach, describe, expect, it } from 'vitest'
import CrewRoster, { capAbilities, DEFAULT_MEMBERS, idFor, memberProblems, migrate, presetFor, SUPERSEDED_PERSONAS, workspaceSummary, type CrewMember } from '../src/index.ts'

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
  it('gives every member one ask_crew tool over all its teammates and lists them in its instructions', () => {
    const crew = [...DEFAULT_MEMBERS, helper]
    for (const member of crew) {
      const preset = presetFor(member, crew)
      const asks = preset.plugins.filter(row => row.name === '@deepseek-ai/dsh-tool-subagent').map(row => row.config as Record<string, unknown>)
      expect(asks, member.id).toEqual([{
        provider: 'spawn', toolName: 'ask_crew', allowedAgentPresets: crew.filter(entry => entry.id !== member.id).map(entry => entry.id), maxDepth: 2,
      }])
      expect(preset.plugins.some(row => row.name === '@deepseek-ai/dsh-tool-subagent-control'), member.id).toBe(true)
    }
    const prefix = String((presetFor(DEFAULT_MEMBERS[1]!, crew).plugins[0]?.config as Record<string, unknown>)['prefix'])
    expect(prefix).toContain('- crew-helper (Helper): Answers quick questions.')
    expect(prefix).toContain('- crew-chief (Chief of staff):')
    expect(prefix).not.toContain('- crew-mail (')
  })

  it('tells web members to check live sources, X included, and the lead to run Heavy mode', () => {
    const prefixOf = (member: CrewMember, crew: readonly CrewMember[]) =>
      String((presetFor(member, crew).plugins[0]?.config as Record<string, unknown>)['prefix'])
    const chief = DEFAULT_MEMBERS.find(member => member.lead === true)!
    const web = { ...helper, abilities: { ...helper.abilities, web: true } }
    const offline = { ...helper, abilities: { ...helper.abilities, web: false } }
    expect(prefixOf(web, [web, chief])).toContain('x.com')
    expect(prefixOf(offline, [offline, chief])).not.toContain('x.com')
    expect(prefixOf(chief, DEFAULT_MEMBERS)).toContain('Heavy mode')
    expect(prefixOf(web, DEFAULT_MEMBERS)).not.toContain('Heavy mode')
    expect(prefixOf(chief, [chief, web])).not.toContain('Heavy mode')
  })

  it('lets file and shell members find and enter the user\'s workspaces', () => {
    const names = (member: CrewMember) => presetFor(member, [member]).plugins.map(row => row.name)
    const reader = { ...helper, abilities: { ...helper.abilities, files: 'read' as const } }
    const none = { ...helper, abilities: { files: 'none' as const, shell: false, web: true, schedule: false } }
    expect(names(reader)).toContain('@deepseek-ai/dsh-tool-working-directory')
    expect(names(none)).not.toContain('@deepseek-ai/dsh-tool-working-directory')
    expect(String((presetFor(reader, [reader]).plugins[0]?.config as Record<string, unknown>)['prefix'])).toContain('crew_workspaces')
  })

  it('lists workspaces by title and path, and says when there are none', () => {
    expect(workspaceSummary([{ title: 'Site', path: '/p/site' }, { title: ' ', path: '/p/api' }])).toBe('- Site: /p/site\n- api: /p/api')
    expect(workspaceSummary([])).toBe('The user has no workspaces yet.')
    expect(workspaceSummary(undefined)).toBe('This dsh keeps no workspace list.')
  })

  it('gives a lone member no delegation tool', () => {
    expect(presetFor(helper, [helper]).plugins.map(row => row.name)).not.toContain('@deepseek-ai/dsh-tool-subagent')
  })
})

describe('capAbilities and migrate', () => {
  it('grants only abilities and approved connections some member already has', () => {
    const reader = { ...helper, abilities: { files: 'read', shell: false, web: true, schedule: false }, connections: ['github', 'slack'] } as const
    const granted = capAbilities({ abilities: { files: 'write', shell: true, web: true, schedule: false }, connections: ['github', 'slack', 'gmail'] }, [reader])
    expect(granted).toEqual({ abilities: { files: 'read', shell: false, web: true, schedule: false }, connections: ['github'], dropped: ['files: write', 'shell', 'slack', 'gmail'] })
    expect(capAbilities({ abilities: { files: 'write', shell: true, web: false, schedule: true }, connections: [] }, DEFAULT_MEMBERS).dropped).toEqual([])
  })

  it('replaces superseded shipped instructions and keeps edited ones', () => {
    const chief = DEFAULT_MEMBERS[0]!
    const old = { ...chief, persona: SUPERSEDED_PERSONAS['crew-chief']![0]! }
    expect(migrate([old])[0]?.persona).toBe(chief.persona)
    const edited = [{ ...chief, persona: 'Mine.' }]
    const all = DEFAULT_MEMBERS.map(member => member.id)
    expect(migrate(edited, all)).toBe(edited)
  })

  it('adds a shipped member the file was never offered, and never one the user removed', () => {
    const firstSix = DEFAULT_MEMBERS.filter(member => member.id !== 'crew-design')
    expect(migrate(firstSix).map(member => member.id)).toEqual(DEFAULT_MEMBERS.map(member => member.id))
    const withoutMail = DEFAULT_MEMBERS.filter(member => member.id !== 'crew-mail')
    expect(migrate(withoutMail, DEFAULT_MEMBERS.map(member => member.id))).toBe(withoutMail)
  })

})

describe('CrewRosterService', () => {
  let home: string | undefined
  afterEach(async () => { if (home !== undefined) await rm(home, { recursive: true, force: true }) })

  async function boot(file?: string) {
    home = await mkdtemp(join(tmpdir(), 'crew-roster-'))
    if (file !== undefined) await writeFile(join(home, 'members.json'), file)
    const live = new Map<string, PresetDefinition>()
    const tools = new Map<string, { execute: (args: unknown, exec: unknown) => Promise<unknown> }>()
    const ctx = new Context()
    ctx.provide('tools', {
      register: (tool: { name: string; execute: (args: unknown, exec: unknown) => Promise<unknown> }) => {
        tools.set(tool.name, tool)
        return () => { tools.delete(tool.name) }
      },
    } as never)
    ctx.provide('agentPresets', {
      presetForSession: (session: { preset: string }) => session.preset,
      register: (definition: PresetDefinition) => {
        if (live.has(definition.id)) return Promise.reject(new Error(`Duplicate agent preset: ${definition.id}`))
        live.set(definition.id, definition)
        return Promise.resolve(() => { live.delete(definition.id); return Promise.resolve() })
      },
    } as never)
    await ctx.plugin(CrewRoster, { homeDirectory: home })
    const roster = await new Promise<CrewRoster>((resolve) => { ctx.inject(['crewRoster'], (inner) => { resolve(inner.crewRoster) }) })
    return { roster, live, home, tools, ctx }
  }

  it('records the offered shipped members in the file', async () => {
    const { home: dir } = await boot(JSON.stringify({ version: 1, members: DEFAULT_MEMBERS.slice(0, 6) }))
    const saved = JSON.parse(await readFile(join(dir, 'members.json'), 'utf8')) as { members: CrewMember[]; shipped: string[] }
    expect(saved.members.map(member => member.id)).toContain('crew-design')
    expect(saved.shipped).toEqual(DEFAULT_MEMBERS.map(member => member.id))
  })

  it('seeds and registers the shipped crew on first run', async () => {
    const { roster, live, home: dir } = await boot()
    expect([...live.keys()]).toEqual(DEFAULT_MEMBERS.map(member => member.id))
    expect((await roster.state()).members).toHaveLength(7)
    expect(JSON.parse(await readFile(join(dir, 'members.json'), 'utf8'))).toMatchObject({ version: 1, members: DEFAULT_MEMBERS })
  })

  it('adds, edits and removes a member and keeps the lead in step', async () => {
    const { roster, live } = await boot()
    const added = await roster.saveMember({ ...helper, id: '', lead: true, builtIn: true })
    expect(added).toMatchObject({ ok: true, value: { id: 'crew-helper', order: 27 } })
    if (!added.ok) return
    expect(added.value.lead).toBeUndefined()
    expect(live.get('crew-helper')?.name).toBe('Helper')
    expect(JSON.stringify(live.get('crew-chief'))).toContain('crew-helper')
    expect(await roster.saveMember({ ...helper, id: '' })).toMatchObject({ ok: false })
    expect(await roster.saveMember({ ...added.value, name: 'Helpful' })).toMatchObject({ ok: true, value: { id: 'crew-helper', name: 'Helpful' } })
    expect(live.get('crew-helper')?.name).toBe('Helpful')
    expect(await roster.saveMember({ ...added.value, persona: '' })).toMatchObject({ ok: false, message: 'Write the member\'s instructions.' })
    expect(await roster.deleteMember('crew-helper')).toEqual({ ok: true, value: true })
    expect(live.has('crew-helper')).toBe(false)
    expect(JSON.stringify(live.get('crew-chief'))).not.toContain('crew-helper')
  })

  it('lets an agent add a member, capped to the crew\'s abilities, and start it on a first task', async () => {
    const { roster, live, tools, ctx } = await boot()
    const started: unknown[] = []
    ctx.provide('subagents', {
      startActivation: (spec: unknown) => {
        started.push(spec)
        return Promise.resolve({ childId: 'child', result: Promise.resolve({ output: [{ type: 'text', text: 'Three sketches.' }], stopReason: 'completed' }) })
      },
    } as never)
    const create = tools.get('crew_member_create')!
    const caller = { session: { preset: 'crew-chief' } }
    const value = await create.execute({
      name: 'Designer', description: 'Sketches screens.', instructions: 'You are Designer.', files: 'write', shell: true, connections: ['slack', 'github'],
      first_task: 'Sketch the login screen.', max_tool_calls: 30,
    }, { agent: caller, signal: new AbortController().signal }) as { summary: string }
    expect(value.summary).toContain('Added Designer as crew-designer. Not granted, because no member has it: slack.')
    expect(value.summary).toContain('Three sketches.')
    expect(started).toEqual([expect.objectContaining({ agentPreset: 'crew-designer', parent: caller, delivery: 'caller', provider: 'spawn' })])
    const added = (await roster.state()).members.find(member => member.id === 'crew-designer')
    expect(added).toMatchObject({ createdBy: 'crew-chief', maxToolCalls: 30, abilities: { files: 'write', shell: true, web: true, schedule: false }, connections: ['github'] })
    expect(JSON.stringify(live.get('crew-mail'))).toContain('crew-designer')
    expect(await roster.saveMember({ ...added!, createdBy: 'someone' })).toMatchObject({ ok: true, value: { createdBy: 'crew-chief' } })
  })

  it('refuses a budgeted member\'s calls past its budget until the next message, ask-user excepted', async () => {
    const { roster, ctx } = await boot()
    const research = (await roster.state()).members.find(member => member.id === 'crew-research')!
    expect(await roster.saveMember({ ...research, maxToolCalls: 2 })).toMatchObject({ ok: true, value: { maxToolCalls: 2 } })
    expect(await roster.saveMember({ ...research, maxToolCalls: 2.5 })).toMatchObject({ ok: false })
    const session = { id: 's-1', preset: 'crew-research' }
    const call = (name = 'web_fetch') => ctx.waterfall('tools/pre-execute', { name, agent: { session } } as never,
      () => Promise.resolve({ kind: 'allow' as const }))
    expect(await call()).toEqual({ kind: 'allow' })
    expect(await call()).toEqual({ kind: 'allow' })
    expect(await call()).toMatchObject({ kind: 'deny', reason: expect.stringContaining('budget of 2 tool calls') as string })
    expect(await call('ask_user_question')).toEqual({ kind: 'allow' })
    ctx.emit('session/event' as never, session as never, { type: 'turn/start' } as never)
    expect(await call()).toEqual({ kind: 'allow' })
    const other = { id: 's-2', preset: 'crew-mail' }
    for (let index = 0; index < 5; index += 1) {
      expect(await ctx.waterfall('tools/pre-execute', { name: 'read', agent: { session: other } } as never,
        () => Promise.resolve({ kind: 'allow' as const }))).toEqual({ kind: 'allow' })
    }
  })

  it('refuses to remove the lead or a missing member', async () => {
    const { roster, live } = await boot()
    expect(await roster.deleteMember('crew-chief')).toMatchObject({ ok: false })
    expect(await roster.deleteMember('crew-nobody')).toMatchObject({ ok: false })
    expect(live.has('crew-chief')).toBe(true)
  })

  it('keeps an unreadable file and runs the shipped crew', async () => {
    const { live, home: dir } = await boot('{ not json')
    expect(live.size).toBe(DEFAULT_MEMBERS.length)
    expect(await readFile(join(dir, 'members.json'), 'utf8')).toBe('{ not json')
  })
})
