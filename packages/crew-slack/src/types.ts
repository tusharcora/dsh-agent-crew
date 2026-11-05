/** Slack drafts and connection state the crew pages read. */

/** Where the Slack connection stands. */
export type SlackState = 'needs-tokens' | 'connecting' | 'connected' | 'failed' | 'off'

/** One reply a crew member drafted for a Slack thread; nothing is posted until the user approves it. */
export interface SlackDraft {
  readonly id: string
  readonly member: string
  readonly sessionId: string
  /** Slack channel and thread the reply belongs to. */
  readonly channel: string
  readonly threadTs: string
  /** Slack user who asked, and what they wrote. */
  readonly askedBy: string
  readonly question: string
  readonly text: string
  readonly status: 'pending' | 'posted' | 'discarded'
  readonly createdAt: string
  /** The approval card in the owner's direct messages, once sent. */
  readonly card?: { readonly channel: string; readonly ts: string }
}

/** What the crew pages read. */
export interface SlackStatus {
  readonly state: SlackState
  /** Why the connection failed or is off, in plain words. */
  readonly detail?: string
  readonly drafts: readonly SlackDraft[]
}

/** Result of a Slack action. */
export type SlackResult<T = true> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string }
