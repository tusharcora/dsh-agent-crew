/** The small part of Slack's Web API and Socket Mode the crew uses. */

/** A fetch the client can be given in tests. */
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

/**
 * One Slack Web API call: POST JSON with a token; Slack reports failure in `ok: false`, not the HTTP status.
 * @param fetcher - fetch to use.
 * @param token - app or bot token.
 * @param method - Web API method, such as `chat.postMessage`.
 * @param body - JSON arguments.
 * @returns Slack's reply; an HTTP failure becomes `ok: false` with the status as the error.
 */
export async function slackCall<T extends Record<string, unknown>>(
  fetcher: Fetch, token: string, method: string, body: Record<string, unknown> = {},
): Promise<T & { readonly ok: boolean; readonly error?: string }> {
  const response = await fetcher(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
  if (!response.ok) return { ok: false, error: `HTTP ${String(response.status)}` } as T & { ok: boolean; error: string }
  return await response.json() as T & { ok: boolean; error?: string }
}

/** A Slack message the crew may answer. */
export interface Incoming {
  readonly channel: string
  readonly user: string
  readonly text: string
  readonly ts: string
  readonly threadTs?: string
  /** A direct message to the bot, which needs no mention. */
  readonly direct: boolean
}

/** A button click on an approval card. */
export interface Click {
  readonly user: string
  readonly action: 'post' | 'discard'
  readonly draftId: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

/**
 * Read one Socket Mode envelope.
 * @param raw - the frame text.
 * @param botUser - the bot's own user id, whose messages are ignored.
 * @returns the envelope id to acknowledge, and the message, click or connection signal it carries.
 */
export function readEnvelope(raw: string, botUser: string | undefined): {
  readonly ack?: string
  readonly incoming?: Incoming
  readonly click?: Click
  readonly reconnect?: boolean
} {
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch (_error: unknown) { return {} }
  const envelope = record(parsed)
  if (envelope === undefined) return {}
  const ack = text(envelope['envelope_id'])
  const base = ack === undefined ? {} : { ack }
  if (envelope['type'] === 'disconnect') return { ...base, reconnect: true }
  const payload = record(envelope['payload'])
  if (envelope['type'] === 'events_api') {
    const event = record(payload?.['event'])
    const channel = text(event?.['channel']), user = text(event?.['user']), body = text(event?.['text']), ts = text(event?.['ts'])
    if (event === undefined || channel === undefined || user === undefined || body === undefined || ts === undefined) return base
    // Edits, joins and the bot's own posts arrive as subtypes or with a bot id; only people's new messages count.
    if (event['subtype'] !== undefined || event['bot_id'] !== undefined || user === botUser) return base
    const direct = event['type'] === 'message' && event['channel_type'] === 'im'
    if (event['type'] !== 'app_mention' && !direct) return base
    const threadTs = text(event['thread_ts'])
    return { ...base, incoming: { channel, user, text: body, ts, direct, ...threadTs === undefined ? {} : { threadTs } } }
  }
  if (envelope['type'] === 'interactive' && payload?.['type'] === 'block_actions') {
    const action = record(Array.isArray(payload['actions']) ? payload['actions'][0] : undefined)
    const user = text(record(payload['user'])?.['id'])
    const id = text(action?.['action_id']), draftId = text(action?.['value'])
    if (user === undefined || draftId === undefined || (id !== 'crew_post' && id !== 'crew_discard')) return base
    return { ...base, click: { user, draftId, action: id === 'crew_post' ? 'post' : 'discard' } }
  }
  return base
}

/** A crew member as routing needs it. */
export interface RouteMember {
  readonly id: string
  readonly name: string
}

/**
 * Pick the crew member a message is for and strip the mention and the member's name from it. A message may open with
 * a member's name or id (`Code, can you…`, `@Crew research: …`); otherwise the thread's member, else the fallback, answers.
 * @param body - the Slack message text.
 * @param members - the crew.
 * @param current - the member already answering this thread, if any.
 * @param fallback - the member for a new thread that names nobody.
 * @returns the member id and the question without the addressing.
 */
export function route(body: string, members: readonly RouteMember[], current: string | undefined, fallback: string): {
  readonly member: string
  readonly question: string
} {
  const stripped = body.replace(/<@[A-Z0-9]+>/g, '').trim()
  const lower = stripped.toLowerCase()
  for (const member of members) {
    for (const label of [member.name.toLowerCase(), member.id, member.id.slice('crew-'.length)]) {
      if (label !== '' && lower.startsWith(label) && /^[\s,:;.!?-]|^$/.test(lower.slice(label.length))) {
        return { member: member.id, question: stripped.slice(label.length).replace(/^[\s,:;.!?-]+/, '').trim() || stripped }
      }
    }
  }
  return { member: current ?? fallback, question: stripped }
}

/**
 * The approval card sent to the owner: who asked what, the drafted reply, and Post and Discard buttons.
 * @param draft - the draft.
 * @param memberName - the drafting member's name.
 * @returns Block Kit blocks and fallback text.
 */
export function approvalCard(draft: { id: string; channel: string; askedBy: string; question: string; text: string }, memberName: string): {
  readonly text: string
  readonly blocks: readonly Record<string, unknown>[]
} {
  const quote = (value: string) => value.split('\n').map(line => `> ${line}`).join('\n').slice(0, 2900)
  return {
    text: `${memberName} drafted a Slack reply for your approval.`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${memberName}* drafted a reply to <@${draft.askedBy}> in <#${draft.channel}>:\n${quote(draft.question)}` } },
      { type: 'section', text: { type: 'mrkdwn', text: draft.text.slice(0, 2900) } },
      {
        type: 'actions', elements: [
          { type: 'button', style: 'primary', action_id: 'crew_post', value: draft.id, text: { type: 'plain_text', text: 'Post reply' } },
          { type: 'button', action_id: 'crew_discard', value: draft.id, text: { type: 'plain_text', text: 'Discard' } },
        ],
      },
    ],
  }
}
