/**
 * Crew write guard: mounted inside each crew preset, it denies MCP tools that change something outside dsh, in direct
 * calls and in calls a `run_code` program dispatches, because both pass the shared tool pipeline's guards.
 * @module @deepseek-ai/dsh-crew-connections/guard
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'

/** Cordis plugin name. */
export const name = 'crew-write-guard'

/** The tool registry whose scoped guard this row adds. */
export const inject = ['tools']

/** Name words that mark a tool as acting outside dsh: sending, posting, buying, deleting, merging, booking and similar. */
export const WRITE_WORDS: ReadonlySet<string> = new Set([
  'send', 'post', 'publish', 'reply', 'forward', 'delete', 'remove', 'trash', 'destroy', 'merge', 'push', 'create', 'update',
  'edit', 'write', 'move', 'rename', 'patch', 'put', 'book', 'buy', 'purchase', 'pay', 'order', 'checkout', 'invite', 'share',
  'archive', 'close', 'cancel', 'approve', 'submit', 'upload', 'comment', 'react', 'star', 'fork', 'transfer', 'assign', 'set',
  'add', 'run', 'execute', 'deploy', 'interact', 'click', 'fill', 'type', 'press', 'agent',
])

/** Tools allowed despite a write word, by server: they prepare work for the user without acting on it. */
export const ALLOWED_WRITES: Readonly<Record<string, readonly string[]>> = {
  gmail: ['create_draft'],
}

/**
 * Split an MCP tool name `mcp__<server>__<tool>`.
 * @param toolName - wire tool name.
 * @returns server and tool, or undefined for a non-MCP tool.
 */
export function mcpParts(toolName: string): { readonly server: string; readonly tool: string } | undefined {
  const match = /^mcp__([A-Za-z0-9_-]+?)__(.+)$/.exec(toolName)
  return match?.[1] === undefined || match[2] === undefined ? undefined : { server: match[1], tool: match[2] }
}

/**
 * Why a tool call is refused for a crew member, or undefined when it may run.
 * @param toolName - wire tool name.
 * @returns the model-facing refusal, or undefined.
 */
export function writeRefusal(toolName: string): string | undefined {
  const parts = mcpParts(toolName)
  if (parts === undefined) return undefined
  if (ALLOWED_WRITES[parts.server]?.includes(parts.tool) === true) return undefined
  const words = parts.tool.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/)
  if (!words.some(word => WRITE_WORDS.has(word))) return undefined
  return `Blocked: ${parts.tool} on ${parts.server} would change something outside dsh. Crew members never send, post, buy, delete, merge `
    + 'or book on their own. Prepare the change (for example a draft), show it to the user and ask them to approve it.'
}

/**
 * Add the guard to the mounting scope.
 * @param ctx - an agent preset scope; the guard applies to that preset's Agents only.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.tools.guard((execution: Readonly<ToolExecution>) => writeRefusal(execution.name)), 'crew-write-guard')
}
