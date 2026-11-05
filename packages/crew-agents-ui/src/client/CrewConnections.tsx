/** Connections list in the Crew tab: each MCP server the crew uses, who uses it, its state, and how to connect it. */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionsState, CrewSecretRef } from './connections.ts'
import { SecretField } from './SecretField.tsx'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** What the list reads and does. */
export interface CrewConnectionsInjected {
  hooks: { connections: HostObservable<ConnectionsState> }
  readonly refresh: () => Promise<void>
  readonly save: (ref: CrewSecretRef, value: string) => Promise<boolean>
  readonly remove: (ref: CrewSecretRef) => Promise<boolean>
  readonly connectGoogle: () => Promise<{ readonly url: string } | { readonly failure: 'client-missing' | 'in-progress' | 'failed' }>
  readonly disconnectGoogle: () => Promise<void>
  /**
   * Open the consent page in a new browser tab.
   * @param url - Google consent URL.
   */
  readonly openUrl: (url: string) => void
}

type Props = InjectFace<CrewConnectionsInjected> & PropsLocale<'crew'>

/** Seconds between status reads while a Google sign-in waits for the browser. */
const SIGN_IN_POLL_MS = 3000

/**
 * Render the connections. Secrets are write-only: a stored one shows as stored and can be replaced or removed.
 * @param props - connection state, actions and copy.
 * @returns the list.
 */
export function CrewConnections({ useConnections, refresh, save, remove, connectGoogle, disconnectGoogle, openUrl, t }: Props) {
  const state = useConnections(value => value)
  const [notice, setNotice] = useState<string | undefined>()
  useEffect(() => { void refresh() }, [refresh])
  const signingIn = state.google?.signingIn === true
  useEffect(() => {
    if (!signingIn) return
    const timer = setInterval(() => { void refresh() }, SIGN_IN_POLL_MS)
    return () => { clearInterval(timer) }
  }, [signingIn, refresh])
  const google = state.google
  const googleState = google === undefined ? t('conn.unknown')
    : google.signedIn ? t('conn.google.signedIn') : signingIn ? t('conn.google.waiting')
      : google.clientConfigured ? t('conn.google.signedOut') : t('conn.google.noClient')
  const github = state.stored.CREW_GITHUB_TOKEN === true
  return (
    <section className={css.connections} aria-label={t('conn.title')}>
      <h3 className={css.subheading}>{t('conn.title')}</h3>
      <p className={css.hint}>{t('conn.intro')}</p>
      {state.error !== undefined && <p className={css.error} role="alert">{t('conn.error')}</p>}

      <article className={css.connection}>
        <header>
          <span className={css.connectionName}>{t('conn.google.name')}</span>
          <span className={css.uses}>{t('conn.uses', { members: `${t('crew-mail')}, ${t('crew-life')}` })}</span>
          <span className={css.state} role="status">{googleState}</span>
        </header>
        {google?.lastError !== undefined && <p className={css.error}>{google.lastError}</p>}
        {google !== undefined && !google.signedIn && <>
          <p className={css.hint}>{t('conn.google.setup', { uri: google.redirectUri })}</p>
          <SecretField label={t('conn.google.clientId')} stored={state.stored.CREW_GOOGLE_CLIENT_ID === true} t={t}
            onSave={value => save('CREW_GOOGLE_CLIENT_ID', value)} onRemove={() => remove('CREW_GOOGLE_CLIENT_ID')} />
          <SecretField label={t('conn.google.clientSecret')} stored={state.stored.CREW_GOOGLE_CLIENT_SECRET === true} t={t}
            onSave={value => save('CREW_GOOGLE_CLIENT_SECRET', value)} onRemove={() => remove('CREW_GOOGLE_CLIENT_SECRET')} />
        </>}
        <div className={css.actions}>
          {google?.signedIn === true
            ? <Button variant="outline" size="sm" onClick={() => { void disconnectGoogle() }}>{t('conn.google.disconnect')}</Button>
            : <Button variant="primary" size="sm" disabled={google?.clientConfigured !== true || signingIn}
              onClick={() => {
                setNotice(undefined)
                void connectGoogle().then((result) => {
                  if ('url' in result) openUrl(result.url)
                  else setNotice(t(`conn.google.${result.failure}`))
                })
              }}>{t('conn.google.signIn')}</Button>}
        </div>
        {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}
      </article>

      <article className={css.connection}>
        <header>
          <span className={css.connectionName}>{t('conn.github.name')}</span>
          <span className={css.uses}>{t('conn.uses', { members: t('crew-code') })}</span>
          <span className={css.state} role="status">{github ? t('conn.github.ready') : t('conn.github.needsToken')}</span>
        </header>
        <p className={css.hint}>{t('conn.github.setup')}</p>
        <SecretField label={t('conn.github.token')} stored={github} t={t}
          onSave={value => save('CREW_GITHUB_TOKEN', value)} onRemove={() => remove('CREW_GITHUB_TOKEN')} />
      </article>

      <ul className={css.simple}>
        <li><span className={css.connectionName}>{t('conn.keyless.firecrawl')}</span><span className={css.state}>{t('conn.keyless')}</span></li>
        <li><span className={css.connectionName}>{t('conn.keyless.cloudflare')}</span><span className={css.state}>{t('conn.keyless')}</span></li>
        <li><span className={css.connectionName}>{t('conn.off.slack')}</span><span className={css.state}>{t('conn.off')}</span></li>
        <li><span className={css.connectionName}>{t('conn.off.exa')}</span><span className={css.state}>{t('conn.off')}</span></li>
        <li><span className={css.connectionName}>{t('conn.off.obsidian')}</span><span className={css.state}>{t('conn.off')}</span></li>
      </ul>
    </section>
  )
}
