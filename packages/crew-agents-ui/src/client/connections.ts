/** Connection state for the Crew tab: Google sign-in status and which crew credentials are stored, never their values. */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { GoogleSignInStart, GoogleStatus } from '@deepseek-ai/dsh-crew-connections/types'

/** Credential references the crew MCP rows read; they mirror `CREW_REFS` of crew-connections. */
export const CREW_SECRET_REFS = [
  'CREW_GOOGLE_CLIENT_ID', 'CREW_GOOGLE_CLIENT_SECRET', 'CREW_GITHUB_TOKEN', 'CREW_SLACK_APP_TOKEN', 'CREW_SLACK_BOT_TOKEN', 'CREW_SLACK_OWNER_ID',
] as const

/** One stored-or-not credential reference. */
export type CrewSecretRef = (typeof CREW_SECRET_REFS)[number]

/** What the Connections list shows. */
export interface ConnectionsState {
  readonly loaded: boolean
  readonly google: GoogleStatus | undefined
  readonly stored: Readonly<Partial<Record<CrewSecretRef, boolean>>>
  /** Last failed read or write, cleared by the next success. */
  readonly error: string | undefined
}

/** Host calls the store needs; each resolves `undefined` when the reply was lost. */
export interface ConnectionsHost {
  readonly googleStatus: () => Promise<GoogleStatus | undefined>
  readonly describe: (refs: readonly CrewSecretRef[]) => Promise<Readonly<Record<string, { readonly configured: boolean }>> | undefined>
  readonly set: (ref: CrewSecretRef, value: string) => Promise<boolean>
  readonly unset: (ref: CrewSecretRef) => Promise<boolean>
  readonly connectGoogle: () => Promise<GoogleSignInStart | undefined>
  readonly disconnectGoogle: () => Promise<boolean>
}

/** Observable connection state with the actions the Crew tab offers. */
export class ConnectionsStore {
  private state: ConnectionsState = { loaded: false, google: undefined, stored: {}, error: undefined }
  private readonly listeners = new Set<() => void>()
  /** Current state. */
  readonly source: HostObservable<ConnectionsState> = {
    getSnapshot: () => this.state,
    subscribe: (listener) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } },
  }

  /** @param host - Remote calls. */
  constructor(private readonly host: ConnectionsHost) {}

  private publish(next: Partial<ConnectionsState>): void {
    this.state = { ...this.state, ...next }
    for (const listener of [...this.listeners]) listener()
  }

  /**
   * Read Google status and which credentials are stored.
   * @returns after the state updates.
   */
  async refresh(): Promise<void> {
    const [google, described] = await Promise.all([this.host.googleStatus(), this.host.describe(CREW_SECRET_REFS)])
    if (google === undefined || described === undefined) {
      this.publish({ loaded: true, error: 'unavailable' })
      return
    }
    const stored = Object.fromEntries(CREW_SECRET_REFS.map(ref => [ref, described[ref]?.configured === true]))
    this.publish({ loaded: true, google, stored, error: undefined })
  }

  /**
   * Store a secret; the value goes to the Host and is never read back.
   * @param ref - reference to store under.
   * @param value - secret text.
   * @returns whether the Host stored it.
   */
  async save(ref: CrewSecretRef, value: string): Promise<boolean> {
    const ok = await this.host.set(ref, value)
    if (!ok) this.publish({ error: 'save' })
    await this.refresh()
    return ok
  }

  /**
   * Remove a stored secret.
   * @param ref - reference to remove.
   * @returns whether the Host removed it.
   */
  async remove(ref: CrewSecretRef): Promise<boolean> {
    const ok = await this.host.unset(ref)
    if (!ok) this.publish({ error: 'save' })
    await this.refresh()
    return ok
  }

  /**
   * Start Google sign-in.
   * @returns the consent URL to open, or the localized failure key.
   */
  async connectGoogle(): Promise<{ readonly url: string } | { readonly failure: 'client-missing' | 'in-progress' | 'failed' }> {
    const started = await this.host.connectGoogle()
    await this.refresh()
    if (started === undefined) return { failure: 'failed' }
    return started.ok ? { url: started.url } : { failure: started.reason }
  }

  /**
   * Sign out of Google.
   * @returns after the state updates.
   */
  async disconnectGoogle(): Promise<void> {
    if (!await this.host.disconnectGoogle()) this.publish({ error: 'save' })
    await this.refresh()
  }
}
