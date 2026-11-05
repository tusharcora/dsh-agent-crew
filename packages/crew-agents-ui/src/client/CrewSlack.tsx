/** Slack card in the Crew tab: the Slack app's credentials, the connection state, and replies waiting for approval. */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SlackDraft, SlackStatus } from '@deepseek-ai/dsh-crew-slack/types'
import type { ConnectionsState, CrewSecretRef } from './connections.ts'
import { SecretField } from './SecretField.tsx'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** What the card reads and does. */
export interface CrewSlackInjected {
  hooks: { connections: HostObservable<ConnectionsState> }
  /** Read the connection state and drafts; undefined when dsh could not be reached. */
  readonly slackStatus: () => Promise<SlackStatus | undefined>
  readonly slackReconnect: () => Promise<void>
  /** Post (optionally edited) or discard a draft; resolves the message to show when it failed. */
  readonly slackDecide: (id: string, action: 'post' | 'discard', text?: string) => Promise<string | undefined>
  readonly save: (ref: CrewSecretRef, value: string) => Promise<boolean>
  readonly remove: (ref: CrewSecretRef) => Promise<boolean>
  readonly nameOf: (member: string) => string
}

type Props = InjectFace<CrewSlackInjected> & PropsLocale<'crew'>

/** Drafts arrive in the background while a member works, so the open card re-reads at this interval. */
const SLACK_POLL_MS = 5000

function Draft({ draft, nameOf, decide, t }: {
  readonly draft: SlackDraft
  readonly nameOf: (member: string) => string
  readonly decide: (action: 'post' | 'discard', text: string) => Promise<void>
  readonly t: Props['t']
}) {
  const [text, setText] = useState(draft.text)
  const [busy, setBusy] = useState(false)
  const act = (action: 'post' | 'discard') => { setBusy(true); void decide(action, text).finally(() => { setBusy(false) }) }
  const name = nameOf(draft.member)
  return (
    <li className={css.connection} aria-label={t('slack.draftLabel', { name })}>
      <span className={css.connectionName}>{name}</span>
      <p className={css.hint}>{t('slack.asked', { question: draft.question })}</p>
      <label className={css.secret}>{t('slack.reply')}
        <textarea rows={4} value={text} onChange={(event) => { setText(event.target.value) }} />
      </label>
      <div className={css.actions}>
        <Button variant="primary" size="sm" disabled={busy || text.trim() === ''} onClick={() => { act('post') }}>{t('slack.post')}</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { act('discard') }}>{t('slack.discard')}</Button>
      </div>
    </li>
  )
}

/**
 * Render the card. Nothing reaches Slack from here except a reply the user posts with its own button.
 * @param props - credential state, Slack status reader, actions and copy.
 * @returns the card.
 */
export function CrewSlack({ useConnections, slackStatus, slackReconnect, slackDecide, save, remove, nameOf, t }: Props) {
  const stored = useConnections(value => value.stored)
  const [status, setStatus] = useState<SlackStatus | undefined | null>(null)
  const [notice, setNotice] = useState<string | undefined>()
  useEffect(() => {
    let live = true
    const read = () => { void slackStatus().then((next) => { if (live) setStatus(next) }) }
    read()
    const timer = setInterval(read, SLACK_POLL_MS)
    return () => { live = false; clearInterval(timer) }
  }, [slackStatus])
  const refresh = async () => { setStatus(await slackStatus()) }
  const keep = (ref: CrewSecretRef) => (value: string) => save(ref, value)
  const drop = (ref: CrewSecretRef) => () => remove(ref)
  const pending = status?.drafts.filter(draft => draft.status === 'pending') ?? []
  const state = status === null ? t('conn.unknown') : status === undefined ? t('slack.unreachable') : t(`slack.state.${status.state}`)
  return (
    <section className={css.connections} aria-label={t('slack.title')}>
      <h3 className={css.subheading}>{t('slack.title')}</h3>
      <p className={css.hint}>{t('slack.intro')}</p>
      <article className={css.connection}>
        <header>
          <span className={css.connectionName}>{t('slack.app')}</span>
          <span className={css.state} role="status">{state}</span>
        </header>
        {status?.detail !== undefined && <p className={css.hint}>{status.detail}</p>}
        <p className={css.hint}>{t('slack.setup')}</p>
        <SecretField label={t('slack.appToken')} stored={stored.CREW_SLACK_APP_TOKEN === true} t={t}
          onSave={keep('CREW_SLACK_APP_TOKEN')} onRemove={drop('CREW_SLACK_APP_TOKEN')} />
        <SecretField label={t('slack.botToken')} stored={stored.CREW_SLACK_BOT_TOKEN === true} t={t}
          onSave={keep('CREW_SLACK_BOT_TOKEN')} onRemove={drop('CREW_SLACK_BOT_TOKEN')} />
        <SecretField label={t('slack.owner')} stored={stored.CREW_SLACK_OWNER_ID === true} t={t}
          onSave={keep('CREW_SLACK_OWNER_ID')} onRemove={drop('CREW_SLACK_OWNER_ID')} />
        <div className={css.actions}>
          <Button variant="outline" size="sm" onClick={() => { void slackReconnect().then(refresh) }}>{t('slack.reconnect')}</Button>
        </div>
      </article>
      <h4 className={css.subheading}>{t('slack.waiting')}</h4>
      {pending.length === 0
        ? <p className={css.hint}>{t('slack.noDrafts')}</p>
        : (
          <ul className={css.simple}>
            {pending.map(draft => (
              <Draft key={draft.id} draft={draft} nameOf={nameOf} t={t} decide={async (action, text) => {
                const failure = await slackDecide(draft.id, action, text)
                setNotice(failure)
                await refresh()
              }} />
            ))}
          </ul>
        )}
      {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}
    </section>
  )
}
