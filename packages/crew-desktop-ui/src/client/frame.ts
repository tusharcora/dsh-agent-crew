/** Pick the screen an agent saw last: the newest image any tool returned in the loaded part of the Session. */
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ImageBlock } from '@deepseek-ai/dsh-llm'

/** One screenshot frame and where it came from. */
export interface DesktopFrame {
  /** Stored image to load. */
  readonly attachment: ImageBlock['attachment']
  /** Tool that returned it, such as a computer-use tool or `run_code`. */
  readonly tool: string
  /** When the result was recorded, in epoch milliseconds. */
  readonly time: number
  /** Session sequence of the result. */
  readonly seq: number
}

/**
 * Find the newest tool-result image.
 * @param entries - the Session's loaded event window.
 * @returns the latest frame, or undefined when no tool has returned an image.
 */
export function latestFrame(entries: readonly SessionEventLikeEntry[]): DesktopFrame | undefined {
  const tools = new Map<string, string>()
  let latest: DesktopFrame | undefined
  for (const entry of entries) {
    if (entry.type !== 'event') continue
    const event = entry.event
    if (event.type === 'tool/call') tools.set(event.data.callId, event.data.name)
    else if (event.type === 'tool/result') {
      const image = event.data.message.content.findLast(block => block.type === 'image')
      if (image?.type === 'image' && image.offloaded !== true) {
        latest = { attachment: image.attachment, tool: tools.get(event.data.message.toolCallId) ?? 'tool', time: event.time, seq: event.seq }
      }
    }
  }
  return latest
}

/**
 * Encode image bytes as a data URL the tab can show without another request.
 * @param bytes - encoded image.
 * @param mediaType - its verified media type.
 * @returns a `data:` URL.
 */
export function dataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return `data:${mediaType};base64,${btoa(binary)}`
}
