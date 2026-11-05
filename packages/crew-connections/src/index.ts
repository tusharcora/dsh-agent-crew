/**
 * Crew connections: Google sign-in for the Gmail and Calendar MCP servers through the authorization seam, the access
 * token kept fresh in the credential store, and the Remote the Crew tab uses to connect accounts.
 * @module @deepseek-ai/dsh-crew-connections
 */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { credentialKey, credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-authorization'
import type { GoogleSignInStart, GoogleStatus, MemberDirectory } from './types.ts'
import { asGrant, authorizationUrl, awaitRedirect, exchangeCode, pkce, refreshGrant, type GoogleClient, type GoogleGrant } from './google.ts'

export { GOOGLE_SCOPES, authorizationUrl, asGrant, pkce, type GoogleGrant } from './google.ts'
export { writeRefusal, mcpParts, WRITE_WORDS, ALLOWED_WRITES } from './guard.ts'
export type { GoogleSignInStart, GoogleStatus, MemberDirectory } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Crew account connections. */
    crewConnections: CrewConnections
  }
}

/** Credential references the crew MCP rows and this service use. */
export const CREW_REFS = {
  googleClientId: 'CREW_GOOGLE_CLIENT_ID',
  googleClientSecret: 'CREW_GOOGLE_CLIENT_SECRET',
  googleAccessToken: 'CREW_GOOGLE_ACCESS_TOKEN',
  githubToken: 'CREW_GITHUB_TOKEN',
} as const

/** The Google grant record this service owns. */
export const GOOGLE_KEY = credentialKey('crew-connections', 'google')

/** Crew member ids a home directory may be created for. */
const MEMBER_ID = /^crew-[a-z]+$/

/** Plugin config. */
export interface Config {
  /** Directory holding one folder per crew member, where chats outside any workspace run. */
  homeDirectory: string
  /** Loopback redirect URI registered on the Google OAuth client. */
  googleRedirectUri: string
  /** Refresh the access token this many seconds before it expires. */
  refreshMarginSeconds: number
  /** Seconds to wait for the browser to return from Google. */
  signInTimeoutSeconds: number
}

/** Runtime config schema. */
export const Config: z<Config> = z.object({
  homeDirectory: z.string().required(),
  googleRedirectUri: z.string().default('http://127.0.0.1:8765/oauth2callback'),
  refreshMarginSeconds: z.number().min(60).default(300),
  signInTimeoutSeconds: z.number().min(30).default(300),
})

/** Google sign-in, token refresh and connection status for the crew. */
export class CrewConnections extends TypertRemoteService {
  static inject = ['credentials', 'authorization']
  static Config = Config
  private lastError: string | undefined
  private refreshing: Promise<void> | undefined

  /**
   * @param ctx - owning plugin context.
   * @param config - redirect URI and timing.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'crewConnections')
  }

  protected [Service.init](): void {
    this.ctx.effect(() => this.ctx.authorization.registerFlow({
      key: GOOGLE_KEY,
      label: 'Google (Gmail and Calendar)',
      methods: [{ id: 'oauth', label: 'Sign in with Google' }],
      run: async (session) => {
        const client = await this.client()
        if (client === undefined) throw new Error('Store the Google OAuth client id and secret first')
        const pair = pkce()
        const deadline = AbortSignal.any([session.signal, AbortSignal.timeout(this.config.signInTimeoutSeconds * 1000)])
        const redirect = awaitRedirect(client.redirectUri, pair.state, deadline,
          '<!doctype html><meta charset="utf-8"><title>dsh</title><p>Signed in. You can close this tab and return to dsh.</p>')
        session.notify({ message: 'Continue in your browser', url: authorizationUrl(client, pair) })
        const grant = await exchangeCode(client, await redirect, pair.verifier, session.signal)
        await session.commit({ kind: 'grant', payload: grant })
        await this.publish(grant)
      },
    }), 'crew-connections: google flow')
    this.ctx.effect(() => {
      const timer = setInterval(() => { void this.refreshIfDue() }, 60_000)
      void this.refreshIfDue()
      return () => { clearInterval(timer) }
    }, 'crew-connections: token refresh')
  }

  private async client(): Promise<GoogleClient | undefined> {
    const [id, secret] = await Promise.all([
      this.ctx.credentials.resolve(credentialRef(CREW_REFS.googleClientId)),
      this.ctx.credentials.resolve(credentialRef(CREW_REFS.googleClientSecret)),
    ])
    if (id === undefined || secret === undefined) return undefined
    return { clientId: id.value, clientSecret: secret.value, redirectUri: this.config.googleRedirectUri }
  }

  /** Store the current access token where the MCP rows read it. */
  private async publish(grant: GoogleGrant): Promise<void> {
    await this.ctx.credentials.set(credentialRef(CREW_REFS.googleAccessToken), grant.accessToken)
    this.lastError = undefined
  }

  /**
   * Refresh the access token when it is within the margin of expiry. Concurrent calls share one refresh, and the
   * record write is serialized by the store, so two processes never rotate one refresh token twice.
   * @returns after the check, and the refresh when one was due.
   */
  async refreshIfDue(): Promise<void> {
    this.refreshing ??= this.refresh().finally(() => { this.refreshing = undefined })
    return this.refreshing
  }

  private async refresh(): Promise<void> {
    try {
      const stored = await this.ctx.credentials.readRecord(GOOGLE_KEY)
      const grant = stored?.kind === 'grant' ? asGrant(stored.payload) : undefined
      if (grant === undefined || grant.expiresAt - Date.now() > this.config.refreshMarginSeconds * 1000) return
      const client = await this.client()
      if (client === undefined) return
      let next: GoogleGrant | undefined
      await this.ctx.credentials.modifyRecord(GOOGLE_KEY, async (current) => {
        const latest = current?.kind === 'grant' ? asGrant(current.payload) : undefined
        if (latest === undefined) return undefined
        // Another process may have refreshed while this one waited for the write lock.
        if (latest.expiresAt - Date.now() > this.config.refreshMarginSeconds * 1000) { next = latest; return undefined }
        next = await refreshGrant(client, latest)
        return { kind: 'grant', payload: next }
      })
      if (next !== undefined) await this.publish(next)
    } catch (error: unknown) {
      this.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Connection state for the Crew tab; carries no secret.
   * @returns Google status.
   */
  @Remote('googleStatus')
  async googleStatus(): Promise<GoogleStatus> {
    const [client, stored] = await Promise.all([this.client(), this.ctx.credentials.readRecord(GOOGLE_KEY)])
    const grant = stored?.kind === 'grant' ? asGrant(stored.payload) : undefined
    return {
      clientConfigured: client !== undefined, signedIn: grant !== undefined,
      ...(grant === undefined ? {} : { expiresAt: grant.expiresAt }),
      redirectUri: this.config.googleRedirectUri,
      signingIn: this.ctx.authorization.describe(GOOGLE_KEY)?.inFlight === true,
      ...(this.lastError === undefined ? {} : { lastError: this.lastError }),
    }
  }

  /**
   * Start Google sign-in and return the consent page URL for the browser to open. The attempt keeps running until
   * the browser returns or the timeout passes; the tab reads the result from {@link googleStatus}.
   * @returns the URL, or why sign-in could not start.
   */
  @Remote('connectGoogle')
  async connectGoogle(): Promise<GoogleSignInStart> {
    if (await this.client() === undefined) return { ok: false, reason: 'client-missing', message: 'Store the Google OAuth client id and secret first' }
    if (this.ctx.authorization.describe(GOOGLE_KEY)?.inFlight === true) return { ok: false, reason: 'in-progress', message: 'A Google sign-in is already waiting' }
    const url = Promise.withResolvers<string>()
    const attempt = this.ctx.authorization.begin({
      key: GOOGLE_KEY,
      interaction: {
        notify: (notice) => { if (notice.url !== undefined) url.resolve(notice.url) },
        prompt: () => Promise.reject(new Error('This sign-in asks no questions')),
      },
    })
    attempt.then((outcome) => {
      if (outcome.status !== 'authorized') this.lastError = 'Google sign-in was cancelled'
    }, (error: unknown) => {
      this.lastError = error instanceof Error ? error.message : String(error)
      url.reject(error)
    })
    try {
      return { ok: true, url: await url.promise }
    } catch (error: unknown) {
      return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * The folder a member's chats run in when they belong to no workspace, created when missing.
   * @param member - crew member id such as `crew-mail`.
   * @returns the absolute path, or why it could not be made.
   */
  @Remote('memberDirectory')
  async memberDirectory(member: string): Promise<MemberDirectory> {
    if (!MEMBER_ID.test(member)) return { ok: false, message: `"${member}" is not a crew member id` }
    const path = join(this.config.homeDirectory, member)
    try {
      await mkdir(path, { recursive: true })
      return { ok: true, path }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Remove the Google grant and the published access token.
   * @returns after both are gone.
   */
  @Remote('disconnectGoogle')
  async disconnectGoogle(): Promise<void> {
    this.ctx.authorization.cancel(GOOGLE_KEY)
    await this.ctx.credentials.deleteRecord(GOOGLE_KEY)
    await this.ctx.credentials.unset(credentialRef(CREW_REFS.googleAccessToken))
  }
}

export default CrewConnections
