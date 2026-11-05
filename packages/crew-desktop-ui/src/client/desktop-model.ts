/** Per-Session Desktop state: the latest frame and its image, whether the agent runs, and whether the user took over. */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionEventSource, SessionFace } from '@deepseek-ai/dsh-api-session-controller/client'
import type { DesktopLocation } from '@deepseek-ai/dsh-crew-desktop/types'
import { dataUrl, latestFrame, type DesktopFrame } from './frame.ts'

/** What the Desktop tab shows. */
export interface DesktopState {
  readonly frame: DesktopFrame | undefined
  /** Loaded image of `frame`, as a data URL. */
  readonly image: string | undefined
  readonly imageFailed: boolean
  readonly running: boolean
  /** The user took over: the agent was stopped and stays stopped until they resume. */
  readonly takenOver: boolean
  readonly location: DesktopLocation | undefined
  /** Whether reading the location failed. */
  readonly locationFailed: boolean
  /** The last Pause or Take over could not stop the agent. */
  readonly stopFailed: boolean
}

/** The Session calls the model needs. */
export type DesktopSession = Pick<SessionFace, 'getSnapshot' | 'subscribe' | 'cancel' | 'readAttachment'>

/** Observable Desktop state for one Session; it follows its sources only while the tab is open. */
export class DesktopModel {
  private state: DesktopState = {
    frame: undefined, image: undefined, imageFailed: false, running: false, takenOver: false,
    location: undefined, locationFailed: false, stopFailed: false,
  }
  private readonly listeners = new Set<() => void>()
  private detach: (() => void) | undefined
  private revision = -1
  private locating = false
  /** Current state. */
  readonly source: HostObservable<DesktopState> = {
    getSnapshot: () => this.state,
    subscribe: (listener) => {
      this.listeners.add(listener)
      if (this.listeners.size === 1) this.attach()
      return () => {
        this.listeners.delete(listener)
        if (this.listeners.size === 0) { this.detach?.(); this.detach = undefined }
      }
    },
  }

  /**
   * @param events - the Session's event window.
   * @param session - the Session, for running state, images and stopping.
   * @param where - reads where computer use runs; undefined when the reply was lost.
   */
  constructor(
    private readonly events: SessionEventSource,
    private readonly session: DesktopSession,
    private readonly where: () => Promise<DesktopLocation | undefined>,
  ) {}

  private publish(next: Partial<DesktopState>): void {
    this.state = { ...this.state, ...next }
    for (const listener of [...this.listeners]) listener()
  }

  private attach(): void {
    const offEvents = this.events.subscribe(() => { this.readFrame() })
    const offSession = this.session.subscribe(() => { this.readRunning() })
    this.detach = () => { offEvents(); offSession() }
    this.readFrame()
    this.readRunning()
    if (this.locating) return
    // The location does not change while dsh runs; read it once per Session.
    this.locating = true
    void this.where().then((location) => { this.publish({ location, locationFailed: location === undefined }) })
  }

  private readRunning(): void {
    const running = this.session.getSnapshot().running
    if (running === this.state.running) return
    // A new turn means the user handed control back, for example by sending a message.
    this.publish(running ? { running, takenOver: false } : { running })
  }

  private readFrame(): void {
    const window = this.events.getSnapshot()
    if (window.revision === this.revision) return
    this.revision = window.revision
    const frame = latestFrame(window.entries)
    if (frame?.seq === this.state.frame?.seq) return
    this.publish({ frame, image: undefined, imageFailed: false })
    if (frame === undefined) return
    void this.session.readAttachment(frame.attachment).then((result) => {
      if (this.state.frame?.seq !== frame.seq) return
      this.publish(result.ok ? { image: dataUrl(result.value.data, frame.attachment.mediaType) } : { imageFailed: true })
    }, () => { if (this.state.frame?.seq === frame.seq) this.publish({ imageFailed: true }) })
  }

  private async stop(): Promise<boolean> {
    const result = await this.session.cancel().catch(() => undefined)
    const ok = result?.ok === true
    this.publish({ stopFailed: !ok })
    return ok
  }

  /**
   * Stop the agent's current turn.
   * @returns whether the Host accepted the stop.
   */
  pause(): Promise<boolean> {
    return this.stop()
  }

  /**
   * Stop the agent and mark that the user is in control.
   * @returns whether the agent was stopped.
   */
  async takeOver(): Promise<boolean> {
    if (this.state.running && !await this.stop()) return false
    this.publish({ takenOver: true, stopFailed: false })
    return true
  }

  /** Hand control back; the agent continues when the user sends it a message. */
  resume(): void {
    this.publish({ takenOver: false })
  }
}
