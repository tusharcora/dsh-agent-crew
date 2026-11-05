// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionEventLikeEntry, SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client'
import type { DesktopLocation } from '@deepseek-ai/dsh-crew-desktop/types'
// The namespace declaration `TranslateNS<'crewDesktop'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { dataUrl, latestFrame } from '../src/client/frame.ts'
import { DesktopModel } from '../src/client/desktop-model.ts'
import { DesktopTab } from '../src/client/DesktopTab.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewDesktop'> = (key, params) => translate(key, params)

const attachment = (id: string) => ({ attachmentId: id, mediaType: 'image/png' as const, bytes: 3, width: 1280, height: 800 })

function call(seq: number, callId: string, name: string): SessionEventLikeEntry {
  return { type: 'event', event: { type: 'tool/call', seq, time: seq * 1000, data: { turn: 1, step: 1, callId, name, arguments: '{}' } } } as never
}

function result(seq: number, callId: string, content: readonly unknown[]): SessionEventLikeEntry {
  return { type: 'event', event: { type: 'tool/result', seq, time: seq * 1000,
    data: { turn: 1, step: 1, message: { id: `m${String(seq)}`, role: 'tool', toolCallId: callId, content, source: { kind: 'tool' } } } } } as never
}

/** An event window and Session the test drives by hand. */
function fixture(entries: SessionEventLikeEntry[] = [], running = false) {
  let window: SessionEventWindow = { entries, hasMore: false, revision: 0, change: { kind: 'replace', entries } }
  let snapshot = { running }
  const eventListeners = new Set<() => void>()
  const sessionListeners = new Set<() => void>()
  const events = {
    getSnapshot: () => window,
    subscribe: (listener: () => void) => { eventListeners.add(listener); return () => { eventListeners.delete(listener) } },
  }
  const session = {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { sessionListeners.add(listener); return () => { sessionListeners.delete(listener) } },
    cancel: vi.fn(async () => ({ ok: true as const, value: { accepted: true as const } })),
    readAttachment: vi.fn(async () => ({ ok: true as const, value: { attachment: attachment('a'), data: new Uint8Array([1, 2, 3]) } })),
  }
  return {
    events, session,
    push(entry: SessionEventLikeEntry) {
      entries = [...entries, entry]
      window = { entries, hasMore: false, revision: window.revision + 1, change: { kind: 'append', entries: [entry] } }
      for (const listener of [...eventListeners]) listener()
    },
    setRunning(next: boolean) {
      snapshot = { running: next }
      for (const listener of [...sessionListeners]) listener()
    },
  }
}

const here: DesktopLocation = { provider: 'cua-macos', host: 'studio', platform: 'darwin' }

async function mount(f: ReturnType<typeof fixture>, where: () => Promise<DesktopLocation | undefined> = async () => here) {
  const model = new DesktopModel(f.events, f.session as never, where)
  await act(async () => {
    render(<DesktopTab
      useDesktop={selector => selector(useSyncExternalStore(
        listener => model.source.subscribe(listener), () => model.source.getSnapshot()))}
      pause={() => model.pause()} takeOver={() => model.takeOver()} resume={() => { model.resume() }} t={t} />)
  })
  return model
}

describe('frame selection', () => {
  it('takes the newest tool-result image and names the tool that returned it', () => {
    const entries = [
      call(1, 'c1', 'getScreenshot'), result(2, 'c1', [{ type: 'image', attachment: attachment('old') }]),
      call(3, 'c2', 'run_code'), result(4, 'c2', [{ type: 'text', text: 'ok' }, { type: 'image', attachment: attachment('new') }]),
      call(5, 'c3', 'web_fetch'), result(6, 'c3', [{ type: 'text', text: 'no image' }]),
    ]
    expect(latestFrame(entries)).toMatchObject({ attachment: { attachmentId: 'new' }, tool: 'run_code', seq: 4, time: 4000 })
  })

  it('ignores offloaded images and returns nothing without one', () => {
    expect(latestFrame([call(1, 'c1', 'shot'), result(2, 'c1', [{ type: 'image', attachment: attachment('x'), offloaded: true }])])).toBeUndefined()
    expect(latestFrame([])).toBeUndefined()
  })

  it('encodes image bytes as a data URL', () => {
    expect(dataUrl(new Uint8Array([104, 105]), 'image/png')).toBe('data:image/png;base64,aGk=')
  })
})

describe('Desktop tab', () => {
  it('shows the empty state and where computer use runs', async () => {
    await mount(fixture())
    expect(screen.getByText('Computer use: cua-macos on studio')).toBeTruthy()
    expect(screen.getByText(/No screen yet/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pause the agent’s current turn' }).hasAttribute('disabled')).toBe(true)
  })

  it('says when no computer-use provider is on and when the Host is unreachable', async () => {
    await mount(fixture(), async () => ({ host: 'studio', platform: 'darwin' }))
    expect(screen.getByText(/No computer-use provider is on/).textContent).toContain('studio')
    cleanup()
    await mount(fixture(), async () => undefined)
    expect(screen.getByText('Couldn’t reach dsh to check where computer use runs.')).toBeTruthy()
  })

  it('shows the latest screen with its tool and time, and follows new frames', async () => {
    const f = fixture([call(1, 'c1', 'getScreenshot'), result(2, 'c1', [{ type: 'image', attachment: attachment('a') }])])
    await mount(f)
    const image = screen.getByRole('img')
    expect(image.getAttribute('src')).toBe('data:image/png;base64,AQID')
    expect(image.getAttribute('alt')).toMatch(/^Screen from getScreenshot at /)
    expect(screen.getByText(/is not a live stream/)).toBeTruthy()
    await act(async () => { f.push(call(3, 'c2', 'click')); f.push(result(4, 'c2', [{ type: 'image', attachment: attachment('b') }])) })
    expect(f.session.readAttachment).toHaveBeenLastCalledWith(expect.objectContaining({ attachmentId: 'b' }))
    expect(screen.getByRole('img').getAttribute('alt')).toMatch(/^Screen from click at /)
  })

  it('reports an image that cannot be loaded', async () => {
    const f = fixture([call(1, 'c1', 'shot'), result(2, 'c1', [{ type: 'image', attachment: attachment('a') }])])
    f.session.readAttachment.mockResolvedValueOnce({ ok: false, error: { code: 'not-found' } } as never)
    await mount(f)
    expect(screen.getByText('Couldn’t load the latest screen.')).toBeTruthy()
  })

  it('pauses only on click, through the Session cancel', async () => {
    const f = fixture([], true)
    await mount(f)
    expect(screen.getByRole('status').textContent).toBe('The agent is working')
    expect(f.session.cancel).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Pause the agent’s current turn' })) })
    expect(f.session.cancel).toHaveBeenCalledTimes(1)
  })

  it('takes over, stays in control until Resume, and ends control when a new turn starts', async () => {
    const f = fixture([], true)
    await mount(f)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop the agent and take control of the computer' })) })
    expect(f.session.cancel).toHaveBeenCalledTimes(1)
    await act(async () => { f.setRunning(false) })
    expect(screen.getByRole('status').textContent).toMatch(/^You’re in control/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Hand control back to the agent' })) })
    expect(screen.getByRole('status').textContent).toBe('The agent is not running')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop the agent and take control of the computer' })) })
    expect(screen.getByRole('status').textContent).toMatch(/^You’re in control/)
    await act(async () => { f.setRunning(true) })
    expect(screen.getByRole('status').textContent).toBe('The agent is working')
  })

  it('says when the agent could not be stopped and keeps the agent in control', async () => {
    const f = fixture([], true)
    f.session.cancel.mockResolvedValueOnce({ ok: false, error: { code: 'busy' } } as never)
    await mount(f)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop the agent and take control of the computer' })) })
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t stop the agent. Try again.')
    expect(screen.getByRole('status').textContent).toBe('The agent is working')
  })
})
