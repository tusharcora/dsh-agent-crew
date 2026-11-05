/** The bundle declares the six crew presets; every child row must load with its package's own config schema. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

interface Row {
  readonly id: string
  readonly name: string
  readonly config?: Record<string, unknown>
  readonly disabled?: unknown
}
interface PresetConfig { readonly id: string; readonly name: string; readonly plugins: readonly Row[] }

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  dependencies: Record<string, string>
  dsh: { bundle: { patch: string } }
}
const patch = yaml.load(readFileSync(new URL(`../${manifest.dsh.bundle.patch}`, import.meta.url), 'utf8'), {
  schema: entryListSchema,
}) as { insert: Row[] }[]
const rows = patch[0]?.insert ?? []
/** Narrow a preset row's config, failing the suite on a malformed one. */
function presetConfig(config: Record<string, unknown> | undefined): PresetConfig {
  const id = config?.['id'], name = config?.['name'], plugins = config?.['plugins']
  if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(plugins)) throw new Error('malformed preset row')
  return { id, name, plugins: plugins as Row[] }
}
const presets = rows.filter(row => row.name === '@deepseek-ai/dsh-agent-preset').map(row => presetConfig(row.config))
const preset = (id: string): PresetConfig => {
  const found = presets.find(entry => entry.id === id)
  if (found === undefined) throw new Error(`missing preset ${id}`)
  return found
}
const SPECIALISTS = ['crew-mail', 'crew-chat', 'crew-code', 'crew-research', 'crew-life']

it('inserts the connections, learning, faces, browser roster and exactly the six crew presets in one layer', () => {
  expect(patch).toHaveLength(1)
  expect(rows[0]?.config?.['homeDirectory']).toBeDefined()
  expect(rows.slice(0, 4).map(({ id, name }) => ({ id, name }))).toEqual([
    { id: 'crew-connections', name: '@deepseek-ai/dsh-crew-connections' },
    { id: 'crew-improve', name: '@deepseek-ai/dsh-crew-improve' },
    { id: 'crew-faces', name: '@deepseek-ai/dsh-crew-faces' },
    { id: 'crew-agents-ui', name: '@deepseek-ai/dsh-crew-agents-ui' },
  ])
  expect(presets.map(entry => entry.id)).toEqual(['crew-chief', ...SPECIALISTS])
  expect(new Set(rows.map(row => row.id)).size).toBe(rows.length)
})

it('declares every package its rows mount as a dependency', () => {
  const names = new Set(rows.flatMap(row => [row.name, ...(row.config?.['plugins'] as Row[] | undefined ?? []).map(child => child.name)]))
  const packages = [...names].map(name => name.split('/').slice(0, 2).join('/'))
  expect(packages.filter(name => manifest.dependencies[name] === undefined)).toEqual([])
})

describe.each(presets.map(entry => [entry.id, entry] as const))('%s', (_id, entry) => {
  it('has a name and its own persona', () => {
    expect(entry.name.trim()).not.toBe('')
    const persona = entry.plugins.find(row => row.name === '@deepseek-ai/dsh-persona')
    const prefix = persona?.config?.['prefix']
    expect(typeof prefix === 'string' && prefix.trim() !== '').toBe(true)
  })

  it('accepts every child row config under its package schema', async () => {
    for (const row of entry.plugins) {
      const module = await import(row.name) as { Config?: unknown; default?: { Config?: unknown } }
      const schema = module.Config ?? module.default?.Config
      if (typeof schema !== 'function') continue
      expect(() => (schema as (value: unknown) => unknown)(row.config ?? {}), `${entry.id}/${row.id}`).not.toThrow()
    }
  }, 60_000)
})

it('lets the Chief delegate to each specialist through its own tool and preset', () => {
  const delegation = preset('crew-chief').plugins.filter(row => row.name === '@deepseek-ai/dsh-tool-subagent')
  expect(delegation.map(row => row.config?.['agentPreset'])).toEqual(SPECIALISTS)
  expect(delegation.map(row => row.config?.['toolName'])).toEqual(['ask_mail', 'ask_chat', 'ask_code', 'ask_research', 'ask_life'])
  for (const row of delegation) expect(row.config?.['provider']).toBe('spawn')
  expect(preset('crew-chief').plugins.some(row => row.name === '@deepseek-ai/dsh-tool-subagent-control')).toBe(true)
})

it('gives no specialist a delegation tool', () => {
  for (const id of SPECIALISTS) {
    expect(preset(id).plugins.map(row => row.name)).not.toContain('@deepseek-ai/dsh-tool-subagent')
  }
})

it('lets only Code write files or run commands', () => {
  for (const id of SPECIALISTS.filter(entry => entry !== 'crew-code')) {
    const names = preset(id).plugins.map(row => row.name)
    expect(names).not.toContain('@deepseek-ai/dsh-tool-bash')
    expect(names).not.toContain('@deepseek-ai/dsh-tool-pwsh')
    const fs = preset(id).plugins.find(row => row.name === '@deepseek-ai/dsh-tool-fs')
    if (fs !== undefined) expect(fs.config).toMatchObject({ write: false, edit: false })
  }
})

describe('connections', () => {
  const mcpRows = presets.flatMap(entry => entry.plugins.filter(row => row.name === '@deepseek-ai/dsh-mcp-client').map(row => ({ preset: entry.id, row })))

  it('runs every preset in code mode behind the crew write guard', () => {
    for (const entry of presets) {
      const names = entry.plugins.map(row => row.name)
      expect(names, entry.id).toContain('@deepseek-ai/dsh-tool-executor-ptc')
      expect(names, entry.id).toContain('@deepseek-ai/dsh-crew-connections/guard')
    }
  })

  it('gives every preset its own approved lessons', () => {
    for (const entry of presets) {
      const lessons = entry.plugins.filter(row => row.name === '@deepseek-ai/dsh-crew-improve/lessons')
      expect(lessons.map(row => row.config?.['member']), entry.id).toEqual([entry.id])
    }
  })

  it('gives each specialist its own MCP servers', () => {
    const byPreset = (id: string) => mcpRows.filter(entry => entry.preset === id).map(entry => entry.row.config?.['serverName'])
    expect(byPreset('crew-mail')).toEqual(['gmail'])
    expect(byPreset('crew-chat')).toEqual(['slack'])
    expect(byPreset('crew-code')).toEqual(['github', 'cloudflare-docs'])
    expect(byPreset('crew-research')).toEqual(['firecrawl', 'cloudflare-docs', 'exa'])
    expect(byPreset('crew-life')).toEqual(['gcal', 'obsidian'])
  })

  it('keeps every secret in the credential store and resolves it at runtime', () => {
    for (const { preset, row } of mcpRows) {
      const text = JSON.stringify(row.config)
      const refs = text.match(/\$\{credential:[A-Z_]+\}/g) ?? []
      if (refs.length > 0) expect(row.config?.['expandTemplates'], `${preset}/${row.id}`).toBe(true)
      expect(text, `${preset}/${row.id}`).not.toMatch(/Bearer (?!\$\{credential:)/)
    }
  })

  it('leaves accounts the user has not approved disabled and asks GitHub for read-only tools', () => {
    const disabled = mcpRows.filter(entry => entry.row.disabled === true).map(entry => entry.row.config?.['serverName'])
    expect(disabled).toEqual(['slack', 'exa', 'obsidian'])
    const github = mcpRows.find(entry => entry.row.config?.['serverName'] === 'github')
    expect(github?.row.config?.['headers']).toMatchObject({ 'X-MCP-Readonly': 'true' })
  })
})
