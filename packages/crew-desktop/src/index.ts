/**
 * Crew desktop, Host half: reports which computer-use provider is mounted and on which machine, for the Desktop tab.
 * @module @deepseek-ai/dsh-crew-desktop
 */
import { hostname, platform } from 'node:os'
import { Service, type Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-computer-use'
import type { DesktopLocation } from './types.ts'

export type { DesktopLocation } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Where crew computer use runs. */
    crewDesktop: CrewDesktop
  }
}

/** Reports the computer-use provider and host to the Desktop tab. */
export class CrewDesktop extends TypertRemoteService {
  private computerUse: Context['computerUse'] | undefined

  /** @param ctx - owning plugin context. */
  constructor(ctx: Context) {
    super(ctx, 'crewDesktop')
  }

  protected [Service.init](): void {
    // Computer use is optional: hold the service only while it is mounted.
    this.ctx.inject(['computerUse'], (inner) => {
      this.computerUse = inner.computerUse
      inner.effect(() => () => { this.computerUse = undefined }, 'crew-desktop.computer-use')
    })
  }

  /**
   * Where computer use runs.
   * @returns the provider name, when one is registered, and the host machine.
   */
  @Remote('where')
  where(): Promise<DesktopLocation> {
    const provider = this.computerUse?.providerName
    return Promise.resolve({ ...provider === undefined ? {} : { provider }, host: hostname(), platform: platform() })
  }
}

export default CrewDesktop
