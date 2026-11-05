// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { SlackStatus } from '@deepseek-ai/dsh-crew-slack/types'
import { CrewSlack } from '../src/client/CrewSlack.tsx'
import type { ConnectionsState } from '../src/client/connections.ts'
import { t } from './translate.client.ts'

afterEach(cleanup)

const connections: ConnectionsState = { loaded: true, google: undefined, stored: { CREW_SLACK_APP_TOKEN: true }, error: undefined }

const status: SlackStatus = {
  state: 'connected',
  drafts: [
    { id: 'd1', member: 'crew-code', sessionId: 's1', channel: 'C1', threadTs: '1.1', askedBy: 'U1', question: 'Why is CI red?', text: 'Lint fails.', status: 'pending', createdAt: '' },
    { id: 'd0', member: 'crew-mail', sessionId: 's0', channel: 'C1', threadTs: '0.1', askedBy: 'U1', question: 'old', text: 'Done.', status: 'posted', createdAt: '' },
  ],
}

async function mount(decide = vi.fn(async (_id?: string, _action?: 'post' | 'discard'): Promise<string | undefined> => undefined)) {
  const reconnect = vi.fn(async () => {})
  await act(async () => {
    render(<CrewSlack useConnections={selector => selector(connections)} slackStatus={async () => status} slackReconnect={reconnect}
      slackDecide={decide} save={vi.fn(async () => true)} remove={vi.fn(async () => true)} nameOf={id => id === 'crew-code' ? 'Code' : id} t={t} />)
  })
  return { decide, reconnect }
}

it('shows the connection state, which credentials are stored, and only pending replies', async () => {
  await mount()
  expect(screen.getByRole('region', { name: 'Slack' }).textContent).toContain('Connected')
  expect(screen.getByLabelText('App-level token').getAttribute('placeholder')).toBe('Stored')
  expect(screen.getByLabelText('Bot token').getAttribute('placeholder')).toBe('')
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.getByRole('listitem', { name: 'Reply drafted by Code' }).textContent).toContain('Asked: Why is CI red?')
})

it('posts the reply as edited, discards, and shows a refusal', async () => {
  const refuse = async (_id?: string, action?: 'post' | 'discard'): Promise<string | undefined> =>
    action === 'post' ? 'Slack refused the reply: not_in_channel' : undefined
  const { decide } = await mount(vi.fn(refuse))
  fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Lint fails on main.' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post reply' })) })
  expect(decide).toHaveBeenCalledWith('d1', 'post', 'Lint fails on main.')
  expect(screen.getByRole('alert').textContent).toBe('Slack refused the reply: not_in_channel')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Discard' })) })
  expect(decide).toHaveBeenLastCalledWith('d1', 'discard', 'Lint fails on main.')
})

it('reconnects on request', async () => {
  const { reconnect } = await mount()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reconnect' })) })
  expect(reconnect).toHaveBeenCalled()
})
