// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { GoogleStatus } from '@deepseek-ai/dsh-experimental-crew-connections/types'
import { CrewConnections } from '../src/client/CrewConnections.tsx'
import { ConnectionsStore, type ConnectionsHost, type CrewSecretRef } from '../src/client/connections.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = makeTranslate(en)
const status = (over: Partial<GoogleStatus> = {}): GoogleStatus => ({
  clientConfigured: false, signedIn: false, redirectUri: 'http://127.0.0.1:8765/oauth2callback', signingIn: false, ...over,
})

function host(over: Partial<ConnectionsHost> = {}, stored: Record<string, boolean> = {}) {
  const values = { ...stored }
  const fake: ConnectionsHost = {
    googleStatus: vi.fn(async () => status({
      clientConfigured: values['CREW_GOOGLE_CLIENT_ID'] === true && values['CREW_GOOGLE_CLIENT_SECRET'] === true,
    })),
    describe: vi.fn(async (refs: readonly CrewSecretRef[]) =>
      Object.fromEntries(refs.map(ref => [ref, { configured: values[ref] === true }]))),
    set: vi.fn(async (ref: CrewSecretRef) => { values[ref] = true; return true }),
    unset: vi.fn(async (ref: CrewSecretRef) => { values[ref] = false; return true }),
    connectGoogle: vi.fn(async () => ({ ok: true as const, url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })),
    disconnectGoogle: vi.fn(async () => true),
    ...over,
  }
  return fake
}

async function mount(fake: ConnectionsHost, openUrl = vi.fn()) {
  const store = new ConnectionsStore(fake)
  await act(async () => {
    render(<CrewConnections
      useConnections={selector => selector(useSyncExternalStore(
        listener => store.source.subscribe(listener), () => store.source.getSnapshot()))}
      refresh={() => store.refresh()}
      save={(ref, value) => store.save(ref, value)} remove={ref => store.remove(ref)} connectGoogle={() => store.connectGoogle()}
      disconnectGoogle={() => store.disconnectGoogle()} openUrl={openUrl} t={t} />)
  })
  return { store, openUrl }
}

it('stores secrets write-only and never shows them back', async () => {
  const fake = host()
  const store = new ConnectionsStore(fake)
  await store.refresh()
  expect(store.source.getSnapshot().stored.CREW_GITHUB_TOKEN).toBe(false)
  expect(await store.save('CREW_GITHUB_TOKEN', 'ghp_secret')).toBe(true)
  expect(fake.set).toHaveBeenCalledWith('CREW_GITHUB_TOKEN', 'ghp_secret')
  expect(store.source.getSnapshot().stored.CREW_GITHUB_TOKEN).toBe(true)
  expect(JSON.stringify(store.source.getSnapshot())).not.toContain('ghp_secret')
})

it('reports a lost connection instead of guessing the state', async () => {
  const store = new ConnectionsStore(host({ googleStatus: vi.fn(async () => undefined) }))
  await store.refresh()
  expect(store.source.getSnapshot()).toMatchObject({ loaded: true, error: 'unavailable' })
})

it('shows each connection with who uses it and its state in words', async () => {
  await mount(host())
  expect(screen.getByRole('region', { name: 'Connections' })).toBeTruthy()
  expect(screen.getByText('Needs an OAuth client')).toBeTruthy()
  expect(screen.getByText('Needs a token')).toBeTruthy()
  expect(screen.getAllByText('No account needed')).toHaveLength(2)
  expect(screen.getAllByText('Off until you approve it')).toHaveLength(3)
  expect(screen.getByText(/add http:\/\/127\.0\.0\.1:8765\/oauth2callback as a redirect URI/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in with Google' }).hasAttribute('disabled')).toBe(true)
})

it('saves a token from its labelled field and clears the field', async () => {
  const fake = host()
  await mount(fake)
  const field = screen.getByLabelText('Personal access token') as HTMLInputElement
  expect(field.type).toBe('password')
  fireEvent.change(field, { target: { value: 'ghp_x' } })
  await act(async () => { fireEvent.submit(field.closest('form') as HTMLFormElement) })
  expect(fake.set).toHaveBeenCalledWith('CREW_GITHUB_TOKEN', 'ghp_x')
  expect(field.value).toBe('')
})

it('opens Google’s consent page once the client is stored, and explains a refusal', async () => {
  const { openUrl } = await mount(host({}, { CREW_GOOGLE_CLIENT_ID: true, CREW_GOOGLE_CLIENT_SECRET: true }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })) })
  expect(openUrl).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1')
  cleanup()
  await mount(host({ connectGoogle: vi.fn(async () => ({ ok: false as const, reason: 'in-progress' as const, message: 'x' })) },
    { CREW_GOOGLE_CLIENT_ID: true, CREW_GOOGLE_CLIENT_SECRET: true }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' })) })
  expect(screen.getByRole('alert').textContent).toBe('A sign-in is already waiting for the browser.')
})
