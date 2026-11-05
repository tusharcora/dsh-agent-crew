/** Google OAuth for the Workspace MCP servers: authorization URL with PKCE, token exchange, refresh and the loopback callback. */
import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'

/** Scopes the Gmail and Calendar MCP servers require; Gmail can draft but not send. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.readonly',
] as const

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/** Stored grant: the refresh token and the current access token with its expiry. */
export interface GoogleGrant {
  readonly refreshToken: string
  readonly accessToken: string
  /** Access token expiry, Unix epoch milliseconds. */
  readonly expiresAt: number
  readonly scope: string
}

/** OAuth client the user created in Google Cloud. */
export interface GoogleClient {
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
}

/** One authorization attempt's secrets. */
export interface PkcePair {
  readonly verifier: string
  readonly challenge: string
  readonly state: string
}

/**
 * Fresh PKCE verifier, S256 challenge and state.
 * @returns the pair.
 */
export function pkce(): PkcePair {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url'), state: randomBytes(24).toString('base64url') }
}

/**
 * Consent page URL; `access_type=offline` and `prompt=consent` make Google return a refresh token.
 * @param client - OAuth client.
 * @param pair - PKCE pair of this attempt.
 * @returns the URL to open in the user's browser.
 */
export function authorizationUrl(client: GoogleClient, pair: PkcePair): string {
  const params = new URLSearchParams({
    client_id: client.clientId, redirect_uri: client.redirectUri, response_type: 'code', scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    code_challenge: pair.challenge, code_challenge_method: 'S256', state: pair.state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

interface TokenResponse {
  readonly access_token?: unknown
  readonly refresh_token?: unknown
  readonly expires_in?: unknown
  readonly scope?: unknown
  readonly error?: unknown
  readonly error_description?: unknown
}

async function tokenRequest(body: URLSearchParams, signal?: AbortSignal): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, ...(signal === undefined ? {} : { signal }),
  })
  const json = await response.json() as TokenResponse
  if (!response.ok || typeof json.access_token !== 'string') {
    const reason = typeof json.error_description === 'string' ? json.error_description : typeof json.error === 'string' ? json.error : `HTTP ${String(response.status)}`
    throw new Error(`Google token request failed: ${reason}`)
  }
  return json
}

function expiry(json: TokenResponse, now: number): number {
  return now + (typeof json.expires_in === 'number' ? json.expires_in : 3600) * 1000
}

/**
 * Exchange an authorization code for tokens.
 * @param client - OAuth client.
 * @param code - code from the callback.
 * @param verifier - PKCE verifier of this attempt.
 * @param signal - cancellation.
 * @returns the grant.
 * @throws when Google refuses or returns no refresh token.
 */
export async function exchangeCode(client: GoogleClient, code: string, verifier: string, signal?: AbortSignal): Promise<GoogleGrant> {
  const json = await tokenRequest(new URLSearchParams({
    client_id: client.clientId, client_secret: client.clientSecret, code, code_verifier: verifier,
    grant_type: 'authorization_code', redirect_uri: client.redirectUri,
  }), signal)
  if (typeof json.refresh_token !== 'string') throw new Error('Google returned no refresh token; remove dsh from your Google account access and sign in again')
  return {
    refreshToken: json.refresh_token, accessToken: json.access_token as string, expiresAt: expiry(json, Date.now()),
    scope: typeof json.scope === 'string' ? json.scope : GOOGLE_SCOPES.join(' '),
  }
}

/**
 * Get a new access token; Google keeps the refresh token unless it rotates one.
 * @param client - OAuth client.
 * @param grant - current grant.
 * @returns the updated grant.
 * @throws when Google refuses, for example after the user revoked access.
 */
export async function refreshGrant(client: Pick<GoogleClient, 'clientId' | 'clientSecret'>, grant: GoogleGrant): Promise<GoogleGrant> {
  const json = await tokenRequest(new URLSearchParams({
    client_id: client.clientId, client_secret: client.clientSecret, refresh_token: grant.refreshToken, grant_type: 'refresh_token',
  }))
  return {
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : grant.refreshToken,
    accessToken: json.access_token as string, expiresAt: expiry(json, Date.now()),
    scope: typeof json.scope === 'string' ? json.scope : grant.scope,
  }
}

/**
 * Narrow a stored grant payload.
 * @param payload - opaque record payload.
 * @returns the grant, or undefined when malformed.
 */
export function asGrant(payload: unknown): GoogleGrant | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const { refreshToken, accessToken, expiresAt, scope } = payload as Record<string, unknown>
  return typeof refreshToken === 'string' && typeof accessToken === 'string' && typeof expiresAt === 'number' && typeof scope === 'string'
    ? { refreshToken, accessToken, expiresAt, scope } : undefined
}

/**
 * Wait for one OAuth redirect on the loopback address, answer the browser and close.
 * @param redirectUri - the registered `http://127.0.0.1:<port>/<path>` or `http://localhost:<port>/<path>` URI.
 * @param state - expected state; a mismatching redirect is answered and ignored.
 * @param signal - cancellation and deadline.
 * @param page - the HTML shown in the browser tab after a successful redirect.
 * @returns the authorization code.
 * @throws when Google reports an error, the port is busy or the signal aborts.
 */
export function awaitRedirect(redirectUri: string, state: string, signal: AbortSignal, page: string): Promise<string> {
  const target = new URL(redirectUri)
  return new Promise((resolve, reject) => {
    const server: Server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', target)
      if (url.pathname !== target.pathname || url.searchParams.get('state') !== state) {
        response.writeHead(404).end()
        return
      }
      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page)
      finish(() => { if (error !== null || code === null) reject(new Error(`Google sign-in ended: ${error ?? 'no code'}`)); else resolve(code) })
    })
    const abort = (): void => { finish(() => { reject(signal.reason instanceof Error ? signal.reason : new Error('Google sign-in was cancelled')) }) }
    function finish(settle: () => void): void {
      signal.removeEventListener('abort', abort)
      server.close()
      settle()
    }
    signal.addEventListener('abort', abort, { once: true })
    server.once('error', (error) => { finish(() => { reject(error) }) })
    server.listen(Number(target.port), target.hostname === 'localhost' ? '127.0.0.1' : target.hostname)
  })
}
