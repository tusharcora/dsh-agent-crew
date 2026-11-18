/**
 * Crew action checker: before a crew member's tool call runs, compare what it is about to do with what its chat was
 * actually asked, and name anything worth a second look. Fixed rules, no model call; a concern turns the call into an
 * ordinary dsh approval prompt, so the user decides and the checker never does.
 */

import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

/** Longest asked-text the projection keeps per chat, newest kept. */
export const MAX_ASKED = 20_000

/** Message sources that carry what the chat was asked: the user, and a lead or teammate handing over work. */
export const ASKED_SOURCES: ReadonlySet<string> = new Set(['user', 'agent-message', 'team-message'])

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const OUTBOUND_TOOL = /send|reply|forward|draft|mail|message|post|invite|share|comment|publish|tweet/i
const NETWORK_COMMAND = /\b(curl|wget|sendmail|mail|mutt|nc|ncat|scp|rsync|ssh|sftp|ftp|telnet)\b/
/** True when any pattern matches; long rules stay readable as lists of short ones. */
const anyOf = (patterns: readonly RegExp[]) => (text: string): boolean => patterns.some(pattern => pattern.test(text))

const UPLOAD = anyOf([
  /\b(curl|wget)\b[^|;&\n]*(\s-d\b|\s--data\b|\s--data-\w+|\s-F\b|\s--form\b|\s-T\b|\s--upload-file\b)/,
  /\b(curl|wget)\b[^|;&\n]*-X\s*(POST|PUT|PATCH)/,
  /\b(scp|rsync)\b[^|;&\n]*\s[\w.-]+@?[\w.-]+:/,
  /\b(nc|ncat|telnet)\b\s+[\w.-]+\s+\d+/,
])
const PIPE_TO_SHELL = /\b(curl|wget)\b[^;&\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/
const SECRET = anyOf([
  /(^|[\s/'"=])\.env(\.[\w-]+)?\b/, /\.ssh\//, /\bid_(rsa|ed25519|ecdsa)\b/, /\.aws\/credentials/, /\.npmrc\b/, /\.netrc\b/,
  /\bsecurity\s+find-(generic|internet)-password\b/, /\b[A-Z0-9_]*(TOKEN|SECRET|API_KEY|PASSWORD)\b/,
])
const DESTRUCTIVE = anyOf([
  /\brm\s+-[a-z]*(r[a-z]*f|f[a-z]*r)[a-z]*\s+(\/|~|\$HOME|\/\*|~\/\*)(\s|$)/i,
  /\bgit\s+push\b[^;&\n]*(\s--force\b|\s-f\b)/,
  /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i,
  /\bmkfs(\.\w+)?\b/,
  /\bdd\b[^;&\n]*\bof=\/dev\//,
])
const SUDO = /(^|[\s;&|(])sudo\s/
const INJECTION = anyOf([
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|messages|rules)/i,
  /disregard (all |any )?(the )?(previous|prior|above) /i,
  /you are now (a|an|in) |new instructions:|system prompt|developer mode/i,
])

/** The text of a call's arguments, for matching. */
function argumentText(args: unknown): string {
  if (typeof args === 'string') return args
  try {
    return args === undefined ? '' : JSON.stringify(args)
  } catch {
    return ''
  }
}

/** The shell command of a bash-like call, if it is one. */
function commandOf(toolName: string, args: unknown): string | undefined {
  if (!/^(bash|pwsh|shell|run_code)$|bash|shell/i.test(toolName) || typeof args !== 'object' || args === null) return undefined
  const fields = args as Record<string, unknown>
  const value = fields['command'] ?? fields['code'] ?? fields['script']
  return typeof value === 'string' ? value : undefined
}

/** Hosts a command contacts. */
function hostsIn(command: string): string[] {
  const hosts = new Set<string>()
  for (const match of command.matchAll(/https?:\/\/([^/\s'"`:]+)/g)) if (match[1] !== undefined) hosts.add(match[1].toLowerCase())
  for (const match of command.matchAll(/\b(?:scp|rsync|ssh|sftp)\b[^|;&\n]*?\s(?:[\w.-]+@)?([\w-]+(?:\.[\w-]+)+):/g)) {
    if (match[1] !== undefined) hosts.add(match[1].toLowerCase())
  }
  for (const match of command.matchAll(/\b(?:nc|ncat|telnet)\s+([\w-]+(?:\.[\w-]+)+)\s+\d+/g)) {
    if (match[1] !== undefined) hosts.add(match[1].toLowerCase())
  }
  return [...hosts]
}

const list = (items: readonly string[]): string =>
  items.length <= 3 ? items.join(', ') : `${items.slice(0, 3).join(', ')} and ${String(items.length - 3)} more`

/**
 * What about a tool call deserves a second look before it runs.
 * @param toolName - wire tool name.
 * @param args - the call's arguments.
 * @param asked - what the chat was asked: the user's own words, a handed-over task, an errand's goal.
 * @returns one sentence per concern; empty when nothing stands out.
 */
export function actionConcerns(toolName: string, args: unknown, asked: string): string[] {
  const text = argumentText(args)
  const command = commandOf(toolName, args)
  const askedLower = asked.toLowerCase()
  const unasked = (value: string) => !askedLower.includes(value.toLowerCase())
  const concerns: string[] = []
  const outbound = OUTBOUND_TOOL.test(toolName) || (command !== undefined && NETWORK_COMMAND.test(command))
  if (outbound) {
    const strangers = [...new Set(text.match(EMAIL) ?? [])].filter(unasked)
    if (strangers.length > 0) concerns.push(`It sends to ${list(strangers)}, which you never mentioned in this chat.`)
  }
  if (command !== undefined) {
    if (PIPE_TO_SHELL.test(command)) concerns.push('It downloads a script and runs it straight away.')
    else if (UPLOAD(command)) {
      const hosts = hostsIn(command).filter(unasked)
      if (hosts.length > 0) concerns.push(`It uploads data to ${list(hosts)}, which you never mentioned in this chat.`)
    }
    if (SECRET(command) && NETWORK_COMMAND.test(command)) concerns.push('It reads secrets and contacts the network in the same command.')
    if (DESTRUCTIVE(command)) {
      concerns.push('It can destroy data that is hard to get back (a forced push, a wiped folder or a dropped table).')
    }
    if (SUDO.test(command)) concerns.push('It asks for administrator rights (sudo).')
  }
  if (INJECTION(text)) concerns.push('Its arguments contain instructions aimed at an AI, a common sign of prompt injection.')
  return concerns
}

/**
 * The approval title for a call with concerns.
 * @param memberName - the member making the call.
 * @param concerns - from {@link actionConcerns}.
 * @returns the question shown to the user.
 */
export function checkerReason(memberName: string, concerns: readonly string[]): string {
  return `Crew checker: ${memberName} wants to run this, and something looks off. ${concerns.join(' ')} Allow it?`
}

/**
 * The decision after the checker's concerns: a refusal or cancellation stands; anything else asks, concerns first, keeping
 * an earlier prompt's own reason after them.
 * @param decision - what the rest of the tool pipeline decided.
 * @param reason - from {@link checkerReason}.
 * @returns the decision to return.
 */
export function withConcerns(decision: PreToolDecision, reason: string): PreToolDecision {
  if (decision.kind === 'deny' || decision.kind === 'cancel') return decision
  const earlier = decision.kind === 'ask' ? decision.displayReason?.en ?? decision.reason : undefined
  const text = earlier === undefined ? reason : `${reason}\n\n${earlier}`
  return { kind: 'ask', reason: text, displayReason: { en: text } }
}

/**
 * Add one message's text to a chat's asked-text, keeping the newest {@link MAX_ASKED} characters.
 * @param asked - the chat's asked-text so far.
 * @param text - the new message's text.
 * @returns the updated asked-text.
 */
export function appendAsked(asked: string, text: string): string {
  const next = asked === '' ? text : `${asked}\n${text}`
  return next.length > MAX_ASKED ? next.slice(next.length - MAX_ASKED) : next
}
