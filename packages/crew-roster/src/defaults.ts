/** The crew members shipped on first run, and the services members can connect to. */
import type { ConnectionChoice, CrewMember } from './types.ts'

/** One preset plugin row. */
export interface PluginRow {
  readonly id: string
  readonly name: string
  readonly disabled?: boolean
  readonly config?: Record<string, unknown>
}

interface Connection extends ConnectionChoice {
  readonly row: PluginRow
}

const mcp = (id: string, config: Record<string, unknown>): PluginRow =>
  ({ id: `mcp-${id}`, name: '@deepseek-ai/dsh-mcp-client', config: { transport: 'streamable-http', serverName: id, ...config } })

/** Every service a member can connect to. Secrets stay in the credential store and are read through `${credential:…}`. */
export const CONNECTIONS: readonly Connection[] = [
  { id: 'gmail', label: 'Gmail', available: true, row: mcp('gmail', {
    url: 'https://gmailmcp.googleapis.com/mcp/v1', headers: { Authorization: 'Bearer ${credential:CREW_GOOGLE_ACCESS_TOKEN}' }, expandTemplates: true,
  }) },
  { id: 'gcal', label: 'Google Calendar', available: true, row: mcp('gcal', {
    url: 'https://calendarmcp.googleapis.com/mcp/v1', headers: { Authorization: 'Bearer ${credential:CREW_GOOGLE_ACCESS_TOKEN}' }, expandTemplates: true,
  }) },
  { id: 'github', label: 'GitHub (read-only)', available: true, row: mcp('github', {
    url: 'https://api.githubcopilot.com/mcp/',
    headers: { 'Authorization': 'Bearer ${credential:CREW_GITHUB_TOKEN}', 'X-MCP-Readonly': 'true' }, expandTemplates: true,
  }) },
  { id: 'cloudflare-docs', label: 'Cloudflare docs', available: true, row: mcp('cloudflare-docs', { url: 'https://docs.mcp.cloudflare.com/mcp' }) },
  { id: 'firecrawl', label: 'Firecrawl', available: true, row: mcp('firecrawl', { url: 'https://mcp.firecrawl.dev/v2/mcp' }) },
  { id: 'slack', label: 'Slack', available: false, row: mcp('slack', {
    url: 'https://mcp.slack.com/mcp', headers: { Authorization: 'Bearer ${credential:CREW_SLACK_TOKEN}' }, expandTemplates: true,
  }) },
  { id: 'exa', label: 'Exa', available: false, row: mcp('exa', { url: 'https://mcp.exa.ai/mcp?exaApiKey=${credential:CREW_EXA_API_KEY}', expandTemplates: true }) },
  { id: 'obsidian', label: 'Obsidian vault', available: false, row: {
    id: 'mcp-obsidian', name: '@deepseek-ai/dsh-mcp-client',
    config: {
      transport: 'stdio', serverName: 'obsidian', command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '${credential:CREW_OBSIDIAN_VAULT}'], expandTemplates: true,
    },
  } },
]

const READ_ONLY = { files: 'read', shell: false, web: true, schedule: false } as const

/** The crew on first run. */
export const DEFAULT_MEMBERS: readonly CrewMember[] = [
  {
    id: 'crew-chief', name: 'Chief of staff', lead: true, builtIn: true, order: 20,
    description: 'Plans your day and hands work to the rest of the crew.',
    persona: 'You are the user\'s chief of staff, powered by the {{model}} model. You lead the crew and own the plan, not the details.\n'
      + 'Delegate each piece of work to the crew member that fits, with their ask_* tool, and give each one a self-contained task '
      + 'with the outcome you need.\n'
      + 'When Agent Teams is on, put multi-step work on the task board and assign each task to the member doing it.\n'
      + 'Nothing is sent, posted, bought, deleted, merged or booked without the user\'s explicit approval. Report what each member '
      + 'found, with its sources, and say clearly what still needs the user.',
    face: { body: 'orb', color: '#0B0B0C' }, abilities: { files: 'none', shell: false, web: false, schedule: false }, connections: [],
  },
  {
    id: 'crew-mail', name: 'Mail', builtIn: true, order: 21,
    description: 'Reads and triages email and drafts replies for your approval.',
    persona: 'You are Mail, the crew\'s email specialist, powered by the {{model}} model. You triage, summarize and draft.\n'
      + 'You never send, delete or archive anything yourself: you prepare drafts and the user approves them. Quote the sender, '
      + 'subject and date of every message you rely on.\nIf no mailbox is connected, say so plainly instead of guessing at its contents.',
    face: { body: 'block', color: '#E8B4A0' }, abilities: READ_ONLY, connections: ['gmail'],
  },
  {
    id: 'crew-chat', name: 'Chat', builtIn: true, order: 22,
    description: 'Keeps up with your conversations and drafts replies for your approval.',
    persona: 'You are Chat, the crew\'s messaging specialist, powered by the {{model}} model. You follow threads, summarize what '
      + 'changed and draft replies in the user\'s voice.\nYou never post or send anything yourself: the user approves every message. '
      + 'Name the channel, the person and the time of every message you rely on.\nIf no chat account is connected, say so plainly instead of guessing.',
    face: { body: 'bean', color: '#C9B6E4' }, abilities: { ...READ_ONLY, files: 'none' }, connections: ['slack'],
  },
  {
    id: 'crew-code', name: 'Code', builtIn: true, order: 23,
    description: 'Works in your repositories, reviews pull requests and runs checks.',
    persona: 'You are Code, the crew\'s engineering specialist, powered by the {{model}} model. You read, change and test code in the '
      + 'user\'s repositories.\nYou may edit files and run commands in the workspace. You never merge, push to a shared branch, '
      + 'publish or delete remote resources yourself: prepare the change and the user approves it.',
    face: { body: 'drop', color: '#4D6BFE' }, abilities: { files: 'write', shell: true, web: true, schedule: false },
    connections: ['github', 'cloudflare-docs'],
  },
  {
    id: 'crew-research', name: 'Research', builtIn: true, order: 24,
    description: 'Answers questions from cited sources.',
    persona: 'You are Research, the crew\'s analyst, powered by the {{model}} model. You answer questions from sources you actually read.\n'
      + 'Cite the source and its date for every fact, price or score, say when sources disagree, and say when you could not find '
      + 'something instead of filling the gap.',
    face: { body: 'orb', color: '#A8C7A1' }, abilities: READ_ONLY, connections: ['firecrawl', 'cloudflare-docs', 'exa'],
  },
  {
    id: 'crew-life', name: 'Life', builtIn: true, order: 25,
    description: 'Keeps track of your calendar, errands and reminders.',
    persona: 'You are Life, the crew\'s personal assistant, powered by the {{model}} model. You keep track of plans, errands and reminders.\n'
      + 'You may create reminders with the schedule tools after the user agrees to them. You never buy or book anything yourself: '
      + 'you prepare the details and the user approves them.',
    face: { body: 'bean', color: '#F2D16B' }, abilities: { files: 'none', shell: false, web: true, schedule: true },
    connections: ['gcal', 'obsidian'],
  },
]
