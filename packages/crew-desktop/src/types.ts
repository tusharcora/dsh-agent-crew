/** Types shared with the browser. */

/** Where an agent's computer use runs. */
export interface DesktopLocation {
  /** Registered computer-use provider, absent while none is mounted. */
  readonly provider?: string
  /** Host machine name. */
  readonly host: string
  /** Host operating system, as Node reports it. */
  readonly platform: string
}
