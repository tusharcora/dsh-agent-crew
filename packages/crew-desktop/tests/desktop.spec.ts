import { hostname, platform } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, expect, it } from 'vitest'
import CrewDesktop from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

it('reports the host and no provider while computer use is not mounted', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(CrewDesktop)
  expect(await ctx.crewDesktop.where()).toEqual({ host: hostname(), platform: platform() })
})

it('names the registered computer-use provider and forgets it when the service goes away', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(CrewDesktop)
  const fork = await ctx.plugin({ name: 'fake-computer-use', apply: (inner: Context) => {
    inner.provide('computerUse', { providerName: 'cua-macos' } as never)
  } })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(await ctx.crewDesktop.where()).toMatchObject({ provider: 'cua-macos', host: hostname() })
  await fork.dispose()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(await ctx.crewDesktop.where()).not.toHaveProperty('provider')
})
