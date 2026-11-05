/** Lesson and proposal types shared with the browser. */

/** What started a reflection. */
export type CrewReflectionTrigger = 'feedback' | 'turns'

/** One standing instruction a crew member follows, approved by the user. */
export interface CrewLesson {
  /** Stable id. */
  readonly id: string
  /** Crew member (preset id) the lesson belongs to. */
  readonly member: string
  /** Instruction text the member reads in its system prompt. */
  readonly text: string
  /** Short quote from the conversation that supports the lesson. */
  readonly evidence: string
  /** Session the evidence comes from. */
  readonly sessionId: string
  /** ISO time the lesson was proposed. */
  readonly proposedAt: string
  /** ISO time the user approved it. */
  readonly approvedAt: string
}

/** A lesson waiting for the user's approval. */
export interface CrewProposal {
  /** Stable id. */
  readonly id: string
  /** Crew member (preset id) the proposal is for. */
  readonly member: string
  /** Proposed instruction text. */
  readonly text: string
  /** Short quote from the conversation that supports it. */
  readonly evidence: string
  /** Session the evidence comes from. */
  readonly sessionId: string
  /** ISO time it was proposed. */
  readonly proposedAt: string
  /** What started the reflection that produced it. */
  readonly trigger: CrewReflectionTrigger
  /** Lesson this proposal would replace when approved. */
  readonly replaces?: string
}

/** One member's lessons and pending proposals. */
export interface CrewLearning {
  /** Crew member (preset id). */
  readonly member: string
  /** Approved lessons, oldest first. */
  readonly lessons: readonly CrewLesson[]
  /** Proposals waiting for the user, oldest first. */
  readonly proposals: readonly CrewProposal[]
}

/** Everything the Crew tab shows about learning. */
export interface CrewImproveState {
  /** Members that have lessons or proposals. */
  readonly members: readonly CrewLearning[]
  /** ISO time of the latest finished reflection. */
  readonly lastReflectedAt?: string
  /** Latest reflection failure, if the last one failed. */
  readonly lastError?: string
}

/** Result of an approval, rejection or removal. */
export type CrewImproveResult = { readonly ok: true } | { readonly ok: false; readonly message: string }
