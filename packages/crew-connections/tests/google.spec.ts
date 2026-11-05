import { createHash } from 'node:crypto'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import Authorization from '@deepseek-ai/dsh-authorization'
import LocalCredentials from '@deepseek-ai/dsh-credentials-local'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import CrewConnections, { CREW_REFS, GOOGLE_KEY } from '../src/index.ts'
import { asGrant, authorizationUrl, awaitRedirect, GOOGLE_SCOPES, pkce } from '../src/google.ts'

afterEach(() => { vi.unstubAllGlobals() })

/** A loopback port free at the time of the call. */
async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
  if (address === null || typeof address === 'string') throw new Error('no port')
  return address.port
}

/** Play the browser returning from Google to the loopback redirect. */
function browserReturn(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request(url, (response) => { response.resume(); resolve(response.statusCode ?? 0) }).on('error', reject).end()
  })
}

function tokenResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('OAuth helpers', () => {
  it('asks for offline access with PKCE and exactly the Gmail and Calendar scopes', () => {
    const pair = pkce()
    expect(createHash('sha256').update(pair.verifier).digest('base64url')).toBe(pair.challenge)
    const url = new URL(authorizationUrl({ clientId: 'id', clientSecret: 's', redirectUri: 'http://127.0.0.1:8765/cb' }, pair))
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'id', redirect_uri: 'http://127.0.0.1:8765/cb', access_type: 'offline', prompt: 'consent',
      code_challenge_method: 'S256', code_challenge: pair.challenge, state: pair.state, scope: GOOGLE_SCOPES.join(' '),
    })
    expect(GOOGLE_SCOPES.some(scope => scope.endsWith('gmail.send'))).toBe(false)
  })

  it('accepts only the redirect carrying its state and stops on cancellation', async () => {
    const port = await freePort()
    const controller = new AbortController()
    const code = awaitRedirect(`http://127.0.0.1:${String(port)}/cb`, 'right', controller.signal, 'ok')
    expect(await browserReturn(`http://127.0.0.1:${String(port)}/cb?state=wrong&code=x`)).toBe(404)
    expect(await browserReturn(`http://127.0.0.1:${String(port)}/cb?state=right&code=the-code`)).toBe(200)
    await expect(code).resolves.toBe('the-code')
    const port2 = await freePort()
    const second = new AbortController()
    const waiting = awaitRedirect(`http://127.0.0.1:${String(port2)}/cb`, 's', second.signal, 'ok')
    second.abort(new Error('stopped'))
    await expect(waiting).rejects.toThrow('stopped')
  })

  it('reads only complete stored grants', () => {
    expect(asGrant({ refreshToken: 'r', accessToken: 'a', expiresAt: 1, scope: 's' })).toEqual({ refreshToken: 'r', accessToken: 'a', expiresAt: 1, scope: 's' })
    expect(asGrant({ refreshToken: 'r' })).toBeUndefined()
  })
})

describe('Google sign-in through the authorization seam', () => {
  async function mount() {
    const home = await mkdtemp(join(tmpdir(), 'crew-connections-'))
    const port = await freePort()
    const ctx = new Context()
    onTestFinished(async () => { await ctx.fiber.dispose(); await rm(home, { recursive: true, force: true }) })
    await ctx.plugin(LocalCredentials, { path: join(home, '.credentials.yaml'), watch: false })
    await ctx.plugin(Authorization)
    await ctx.plugin(CrewConnections, {
      homeDirectory: join(home, 'crew'), googleRedirectUri: `http://127.0.0.1:${String(port)}/oauth2callback`,
      refreshMarginSeconds: 300, signInTimeoutSeconds: 30,
    })
    return Object.assign(ctx, { home })
  }

  it('creates a folder per crew member for chats outside any workspace, and refuses other names', async () => {
    const ctx = await mount()
    const result = await ctx.crewConnections.memberDirectory('crew-mail')
    expect(result).toEqual({ ok: true, path: join(ctx.home, 'crew', 'crew-mail') })
    expect((await stat(join(ctx.home, 'crew', 'crew-mail'))).isDirectory()).toBe(true)
    expect(await ctx.crewConnections.memberDirectory('../etc')).toMatchObject({ ok: false })
  })

  it('refuses to start without the OAuth client', async () => {
    const ctx = await mount()
    expect(await ctx.crewConnections.connectGoogle()).toMatchObject({ ok: false, reason: 'client-missing' })
    expect(await ctx.crewConnections.googleStatus()).toMatchObject({ clientConfigured: false, signedIn: false })
  })

  it('signs in, stores the grant, publishes the access token, refreshes it when due and disconnects', async () => {
    const ctx = await mount()
    await ctx.credentials.set(credentialRef(CREW_REFS.googleClientId), 'client-id')
    await ctx.credentials.set(credentialRef(CREW_REFS.googleClientSecret), 'client-secret')
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body instanceof URLSearchParams ? init.body : new URLSearchParams()
      return body.get('grant_type') === 'authorization_code'
        ? tokenResponse({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600, scope: GOOGLE_SCOPES.join(' ') })
        : tokenResponse({ access_token: 'access-2', expires_in: 3600 })
    })
    vi.stubGlobal('fetch', fetch)

    const started = await ctx.crewConnections.connectGoogle()
    if (!started.ok) throw new Error(started.message)
    const consent = new URL(started.url)
    expect(consent.searchParams.get('client_id')).toBe('client-id')
    const redirect = new URL(consent.searchParams.get('redirect_uri') ?? '')
    redirect.searchParams.set('state', consent.searchParams.get('state') ?? '')
    redirect.searchParams.set('code', 'auth-code')
    expect(await browserReturn(redirect.toString())).toBe(200)
    await vi.waitFor(async () => { expect((await ctx.crewConnections.googleStatus()).signedIn).toBe(true) })
    expect((await ctx.credentials.resolve(credentialRef(CREW_REFS.googleAccessToken)))?.value).toBe('access-1')
    const firstBody = fetch.mock.calls[0]?.[1]?.body
    expect(firstBody instanceof URLSearchParams ? firstBody.get('code_verifier') : undefined).toBeTruthy()

    await ctx.credentials.modifyRecord(GOOGLE_KEY, async current => current?.kind === 'grant'
      ? { kind: 'grant', payload: { ...(current.payload as object), expiresAt: Date.now() + 1000 } } : undefined)
    await ctx.crewConnections.refreshIfDue()
    expect((await ctx.credentials.resolve(credentialRef(CREW_REFS.googleAccessToken)))?.value).toBe('access-2')
    const stored = await ctx.credentials.readRecord(GOOGLE_KEY)
    expect(stored?.kind === 'grant' ? asGrant(stored.payload)?.refreshToken : undefined).toBe('refresh-1')

    await ctx.crewConnections.disconnectGoogle()
    expect(await ctx.crewConnections.googleStatus()).toMatchObject({ signedIn: false })
    expect(await ctx.credentials.resolve(credentialRef(CREW_REFS.googleAccessToken))).toBeUndefined()
  })
})
