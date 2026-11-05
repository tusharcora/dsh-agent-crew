/** Crew member records the roster stores and the browser edits. */

/** Face body shapes; they match `@deepseek-ai/dsh-crew-faces`. */
export type MemberBody = 'orb' | 'block' | 'drop' | 'bean'

/** A member's face. */
export interface MemberFace {
  readonly body: MemberBody
  /** `#rrggbb`. */
  readonly color: string
}

/** How far a member may touch files. */
export type FileAccess = 'none' | 'read' | 'write'

/** Tools a member gets beyond the ones every member has. */
export interface MemberAbilities {
  readonly files: FileAccess
  /** Run commands in a shell, with background jobs. */
  readonly shell: boolean
  /** Fetch web pages. */
  readonly web: boolean
  /** Create and edit scheduled tasks. */
  readonly schedule: boolean
}

/** One crew member; its id is also its agent preset id. */
export interface CrewMember {
  /** `crew-` and lowercase letters; fixed once created. */
  readonly id: string
  readonly name: string
  /** One line on what the member does; the Chief reads it when choosing whom to ask. */
  readonly description: string
  /** Instructions that open the member's system prompt; `{{model}}` names the model. */
  readonly persona: string
  readonly face: MemberFace
  readonly abilities: MemberAbilities
  /** Ids from the connection catalog. */
  readonly connections: readonly string[]
  /** The lead hands work to every other member and cannot be removed. */
  readonly lead?: boolean
  /** Shipped with the crew; its name is shown translated until the user renames it. */
  readonly builtIn?: boolean
  readonly order: number
}

/** A service a member can connect to. */
export interface ConnectionChoice {
  readonly id: string
  readonly label: string
  /** False while the account behind it waits for the user's approval; such a connection stays off. */
  readonly available: boolean
}

/** What the roster page reads. */
export interface RosterState {
  readonly members: readonly CrewMember[]
  readonly connections: readonly ConnectionChoice[]
}

/** Result of a roster change. */
export type RosterResult<T = true> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string }
