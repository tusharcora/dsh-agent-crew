/** Connection status shared by the Host Remote and the Crew tab; carries no secret. */

/** What the Crew tab shows about the Google connection; never a token. */
export interface GoogleStatus {
  /** Whether the client id and secret are stored. */
  readonly clientConfigured: boolean
  /** Whether a grant is stored. */
  readonly signedIn: boolean
  /** Access token expiry, Unix epoch milliseconds, when signed in. */
  readonly expiresAt?: number
  /** Redirect URI to register on the OAuth client. */
  readonly redirectUri: string
  /** A sign-in is waiting for the browser. */
  readonly signingIn: boolean
  /** Reason the last sign-in or refresh failed, cleared by the next success. */
  readonly lastError?: string
}

/** Outcome of starting a sign-in. */
export type GoogleSignInStart =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: 'client-missing' | 'in-progress' | 'failed'; readonly message: string }

/** Where a member's workspace-less chats run, or why that folder is unavailable. */
export type MemberDirectory =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly message: string }
