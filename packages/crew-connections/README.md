---
description: "Crew account connections: Google sign-in for the Gmail and Calendar MCP servers through the authorization seam, access-token refresh, and the write guard every crew preset mounts."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-connections

English | [中文](README.zh.md)

## Summary

Crew members read mail, calendars and code through MCP servers. This package signs the user in to Google for the Gmail and Calendar servers through dsh's authorization seam, keeps the access token fresh in the credential store, and gives the Crew tab a Remote to connect and disconnect. Its `./guard` entry, mounted inside each crew preset, refuses MCP tools that would send, post, buy, delete, merge or book, whether the model calls them directly or from a `run_code` program.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The [crew-agents](../crew-agents/README.md) bundle mounts the service and puts the guard in every crew preset. Connect accounts from the **Connections** list in the right panel's **Crew** tab.

| Field | Default | Meaning |
|---|---|---|
| `homeDirectory` | required; the bundle sets `<dsh home>/crew` | Folder holding one directory per member for chats outside any workspace |
| `googleRedirectUri` | `http://127.0.0.1:8765/oauth2callback` | Loopback redirect registered on the Google OAuth client |
| `refreshMarginSeconds` | `300` | Refresh the access token this long before it expires, at least 60 |
| `signInTimeoutSeconds` | `300` | How long a sign-in waits for the browser, at least 30 |

### Google

Google's Gmail and Calendar MCP servers are in the Workspace developer preview. Create a **Web application** OAuth client marked for an AI agent, register the redirect URI above, join the preview, then store the client id and secret in the Crew tab and choose **Sign in with Google**. The scopes are `gmail.readonly`, `gmail.compose`, `calendar.calendarlist.readonly`, `calendar.events.freebusy` and `calendar.events.readonly`; none can send mail.

### Credentials

| Reference or record | Holds |
|---|---|
| `CREW_GOOGLE_CLIENT_ID`, `CREW_GOOGLE_CLIENT_SECRET` | The OAuth client, stored from the Crew tab |
| `crew-connections/google` record | Refresh token, access token and expiry |
| `CREW_GOOGLE_ACCESS_TOKEN` | Current access token, read by the Gmail and Calendar MCP rows |
| `CREW_GITHUB_TOKEN` | GitHub token, stored from the Crew tab and read by the GitHub MCP row |

The Remote `crewConnections` offers `googleStatus()`, `connectGoogle()` and `disconnectGoogle()`, none of which returns a secret, and `memberDirectory(member)`, which creates and returns the folder a member's chats outside any workspace run in.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The service registers one authorization flow for `crew-connections/google`. An attempt creates a PKCE pair and state, listens once on the loopback redirect, reports the consent URL through `notify`, exchanges the code with `access_type=offline`, commits the grant through the session and publishes the access token. `connectGoogle` starts the attempt with an interaction that returns that URL to the browser and declines any prompt. Every minute, a token within the margin of expiry is refreshed inside `modifyRecord`, so two processes never rotate one refresh token twice; a failure is reported in `googleStatus().lastError`.

The guard splits `mcp__<server>__<tool>` names into words and refuses a tool when a word marks a change outside dsh, such as `send`, `post`, `delete`, `merge`, `push`, `create`, `book` or `buy`. Gmail's `create_draft` is the one allowed exception: a draft waits for the user. Built-in tools are left to their own policy. `ctx.tools.guard` runs after pre-execute policy in the shared pipeline that both the native and PTC executors use.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, flow, refresh and Remote |
| [`src/google.ts`](src/google.ts) | OAuth URL, PKCE, token calls and loopback redirect |
| [`src/guard.ts`](src/guard.ts) | Write guard plugin |
| [`src/types.ts`](src/types.ts) | Status types shared with the browser |
| [`tests/`](tests/) | Guard rules and registry denial, OAuth helpers, sign-in, refresh and disconnect |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [authorization](../../credentials/authorization/README.md) — flows and attempts.
- [mcp-client](../../mcp/mcp-client/README.md#runtime-templates-and-credentials) — `${credential:REF}` templates.
- [crew-agents](../crew-agents/README.md) — the presets and their MCP rows.

<a id="model-experience"></a>
## Model Experience

### Write guard refusal

#### What the model sees

A refused MCP call fails with a message naming the tool and server, followed by the guidance below.

##### Refusal guidance

```markdown
would change something outside dsh. Crew members never send, post, buy, delete, merge or book on their own. Prepare the change (for example a draft), show it to the user and ask them to approve it.
```

#### Token effect

About 50 tokens per refused call; allowed calls add nothing.

#### KV Cache effect

The refusal is an ordinary tool result appended to history; it does not change earlier messages or the tool declarations.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Google's Gmail and Calendar MCP servers are in developer preview and need the user's own Google Cloud project and OAuth client.
- The guard reads tool names, so a server whose write tools have neutral names is not covered; GitHub is also connected in read-only mode at the server.
- Built-in tools such as `bash` in the Code preset are not guarded here; they follow dsh's sandbox and approval policy.
- Approval cards for drafted actions arrive with crew-today; until then the model asks the user in the conversation.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The sign-in test drives the real authorization and local credential plugins and a real loopback redirect, stubbing only Google's token endpoint.

</details>
