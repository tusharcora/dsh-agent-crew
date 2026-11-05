/**
 * The experience reflector, after Harness² (Google Research, Apache 2.0): read one conversation and the user's ratings,
 * then propose a few evidence-backed lessons for the member's standing instructions. Unlike Harness², nothing is
 * re-run to compare candidates; the user's approval stands in for the probe.
 */
import type { ContentBlock, Message, MessageId } from '@deepseek-ai/dsh-llm'
import type { MessageFeedbackItem } from '@deepseek-ai/dsh-message-feedback'
import type { CrewLesson } from './types.ts'

/** Crew member preset ids. */
export const CREW_MEMBER = /^crew-[a-z]+$/

/** At most this many proposals come from one reflection. */
export const MAX_PROPOSALS = 3

/** Longest lesson or evidence text kept, in characters. */
export const MAX_TEXT = 280

/**
 * The crew member a Session runs.
 * @param preset - the Session's agent preset, from the preset registry.
 * @returns the member id, or undefined for a Session that is not a crew member's.
 */
export function memberOf(preset: string | null | undefined): string | undefined {
  return typeof preset === 'string' && CREW_MEMBER.test(preset) ? preset : undefined
}

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join(' ').replace(/\s+/g, ' ').trim()
}

function toolsOf(blocks: readonly ContentBlock[]): readonly string[] {
  return blocks.flatMap(block => block.type === 'tool-call' ? [block.name] : [])
}

function ratingLine(item: MessageFeedbackItem): string {
  const note = item.note === undefined ? '' : `: ${item.note.replace(/\s+/g, ' ').trim()}`
  const category = item.category === undefined ? '' : ` [${item.category}]`
  return `[user rated assistant ${item.messageId} ${item.rating}${category}]${note}`
}

/**
 * Render the conversation for the reflector: what the user said, what the member answered and which tools it used,
 * and each rating right after the message it rates. The oldest lines are dropped first when the transcript is too long.
 * @param messages - the Session's current model history.
 * @param ratings - the user's current ratings in this Session.
 * @param maxChars - transcript budget in characters.
 * @returns transcript lines joined by newlines.
 */
export function transcriptOf(messages: readonly Message[], ratings: readonly MessageFeedbackItem[], maxChars: number): string {
  const byMessage = new Map<MessageId, MessageFeedbackItem>(ratings.map(item => [item.messageId, item]))
  const lines: string[] = []
  for (const message of messages) {
    if (message.role === 'user' && message.source.kind === 'user') {
      const text = textOf(message.content)
      if (text !== '') lines.push(`[user] ${text}`)
    } else if (message.role === 'assistant') {
      const text = textOf(message.content)
      const tools = toolsOf(message.content)
      const used = tools.length > 0 ? ` (tools: ${tools.join(', ')})` : ''
      if (text !== '' || used !== '') lines.push(`[assistant ${message.id}] ${text}${used}`)
      const rating = byMessage.get(message.id)
      if (rating !== undefined) { lines.push(ratingLine(rating)); byMessage.delete(message.id) }
    }
  }
  // Ratings of messages no longer in history (for example after compaction) still count.
  for (const rating of byMessage.values()) lines.push(ratingLine(rating))
  const kept: string[] = []
  let size = 0
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index] ?? ''
    if (size + line.length + 1 > maxChars) break
    kept.unshift(line)
    size += line.length + 1
  }
  return kept.join('\n')
}

/**
 * System instruction for the reflector.
 * @param member - crew member id.
 * @returns the instruction.
 */
export function reflectionSystem(member: string): string {
  return [
    `You improve the standing instructions of "${member}", one member of the user's AI crew, from one of its conversations.`,
    'Read the transcript and the user\'s ratings. Find what the user corrected, repeated, rated down or praised, and turn it into lessons the member should follow in every future conversation.',
    `Propose at most ${String(MAX_PROPOSALS)} lessons. Each must be general (not about this one task), short, written as an instruction to the member, and supported by a quote from the transcript.`,
    'Do not repeat or contradict a current lesson; to change one, propose its replacement and give its id in "replaces".',
    'Never propose anything about sending, posting, buying, deleting, merging or booking without approval, about permissions, tools, accounts or credentials; those are fixed by the user.',
    'If the transcript gives no clear evidence, propose nothing.',
    'Reply with JSON only: {"proposals":[{"lesson":"...","evidence":"exact short quote","replaces":null}]}',
  ].join('\n')
}

/**
 * User input for the reflector, framed as JSON so conversation text cannot break the structure.
 * @param lessons - the member's current lessons.
 * @param transcript - rendered conversation.
 * @returns the input text.
 */
export function reflectionInput(lessons: readonly CrewLesson[], transcript: string): string {
  return `Current lessons and the conversation, as JSON:\n${JSON.stringify({
    currentLessons: lessons.map(lesson => ({ id: lesson.id, lesson: lesson.text })),
    transcript,
  })}`
}

/** A proposal parsed from reflector output, before it gets an id. */
export interface ParsedProposal {
  readonly text: string
  readonly evidence: string
  readonly replaces?: string
}

/**
 * Normalize text for duplicate detection.
 * @param text - lesson text.
 * @returns lower-case words joined by single spaces.
 */
export function lessonKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function clip(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : ''
}

/**
 * Parse and validate reflector output.
 * @param output - model text, expected to hold one JSON object.
 * @param lessonIds - ids of the member's current lessons, the only valid `replaces` targets.
 * @param known - lesson keys already present, pending or rejected; matching proposals are dropped.
 * @returns at most {@link MAX_PROPOSALS} new proposals.
 */
export function parseProposals(output: string, lessonIds: ReadonlySet<string>, known: ReadonlySet<string>): ParsedProposal[] {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end <= start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(output.slice(start, end + 1))
  } catch {
    return []
  }
  const list: unknown = typeof parsed === 'object' && parsed !== null && 'proposals' in parsed ? parsed.proposals : undefined
  if (!Array.isArray(list)) return []
  const seen = new Set(known)
  const out: ParsedProposal[] = []
  for (const entry of list as unknown[]) {
    if (out.length >= MAX_PROPOSALS) break
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const text = clip(record['lesson'])
    const evidence = clip(record['evidence'])
    const key = lessonKey(text)
    if (key === '' || evidence === '' || seen.has(key)) continue
    seen.add(key)
    const replaces = typeof record['replaces'] === 'string' && lessonIds.has(record['replaces']) ? record['replaces'] : undefined
    out.push(replaces === undefined ? { text, evidence } : { text, evidence, replaces })
  }
  return out
}

/**
 * The system-prompt section a member reads.
 * @param lessons - its approved lessons.
 * @returns section text, or empty when there are none.
 */
export function lessonsSection(lessons: readonly CrewLesson[]): string {
  if (lessons.length === 0) return ''
  return [
    '# Lessons from earlier conversations',
    'The user approved these lessons from your earlier conversations with them. Follow them unless the user asks otherwise now. They never relax the rules above about approval.',
    ...lessons.map(lesson => `- ${lesson.text}`),
  ].join('\n')
}
