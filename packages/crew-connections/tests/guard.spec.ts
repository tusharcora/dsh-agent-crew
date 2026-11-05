import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, onTestFinished } from 'vitest'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import * as Guard from '../src/guard.ts'
import { mcpParts, writeRefusal } from '../src/guard.ts'

describe('writeRefusal', () => {
  it('blocks MCP tools that send, post, delete, merge, buy or book', () => {
    for (const name of [
      'mcp__gmail__send_message', 'mcp__slack__post_message', 'mcp__github__merge_pull_request', 'mcp__obsidian__write_file',
      'mcp__obsidian__move_file', 'mcp__shop__buyItem', 'mcp__travel__book_flight', 'mcp__firecrawl__firecrawl_agent',
      'mcp__github__delete_branch',
    ]) expect(writeRefusal(name), name).toMatch(/^Blocked: /)
  })

  it('lets reads, searches and Gmail drafts through', () => {
    for (const name of [
      'mcp__gmail__search_threads', 'mcp__gmail__get_message', 'mcp__gmail__create_draft', 'mcp__gmail__label_message',
      'mcp__gcal__list_events', 'mcp__github__get_pull_request', 'mcp__firecrawl__firecrawl_scrape', 'mcp__cloudflare-docs__search_cloudflare_documentation',
    ]) expect(writeRefusal(name), name).toBeUndefined()
  })

  it('leaves built-in tools to their own policy', () => {
    expect(writeRefusal('write')).toBeUndefined()
    expect(writeRefusal('run_code')).toBeUndefined()
    expect(mcpParts('bash')).toBeUndefined()
  })

  it('tells the model to prepare the change and ask the user', () => {
    expect(writeRefusal('mcp__gmail__send_message')).toContain('ask them to approve it')
  })
})

it('denies a write tool through the registry guard of the scope it is mounted in', async () => {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(Guard)
  const exec = (name: string) => ({ name } as Readonly<ToolExecution>)
  expect(ctx.tools.checkGuards(exec('mcp__slack__post_message'))).toMatch(/^Blocked: /)
  expect(ctx.tools.checkGuards(exec('mcp__slack__search_messages'))).toBeUndefined()
})
