---
description: "Crew Slack: mention the crew in Slack while this computer runs dsh; each thread is a dsh Session with the named member, and every reply waits for your approval before it is posted."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-slack

English | [中文](README.zh.md)

## Summary

Lets you ping the crew from Slack, including the Slack app on your phone, while this computer runs dsh. A Socket Mode connection, opened from this computer, receives mentions of the Crew app and direct messages to it. A message that opens with a member's name goes to that member; otherwise Chief of staff answers. Each Slack thread is one dsh Session. A reply becomes a draft with an approval card in your Slack direct messages and in the Crew tab, and nothing is posted until you click **Post reply**.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this package with its home under `~/.dsh/crew`.

1. At [api.slack.com/apps](https://api.slack.com/apps) choose **Create New App → From an app manifest**, pick your workspace and paste [`slack-app.yml`](slack-app.yml).
2. Under **Basic Information → App-Level Tokens**, generate a token with `connections:write` (it starts with `xapp-`).
3. **Install to Workspace**, then copy the **Bot User OAuth Token** (`xoxb-`).
4. In Slack, open your profile, choose **⋯ → Copy member ID** (`U…`).
5. In the dsh **Crew** tab, store the three values under **Slack** and click **Reconnect**. Invite `@Crew` to the channels where you want to use it.

Then write `@Crew Code, why is CI red?` in a channel, or message Crew directly. Only you, and the Slack users in `allowedUsers`, are answered; messages from anyone else are ignored.

| Field | Default | Meaning |
|---|---|---|
| `homeDirectory` | required | Folder for `slack.json` (threads and drafts) |
| `allowedUsers` | `[]` | Slack member ids besides yours whose messages the crew answers |
| `fallbackMember` | `crew-chief` | Member for a new thread that names nobody |
| `replyTimeoutMinutes` | `30` | How long to wait for a member's reply |
| `keepDrafts` | `50` | Drafts kept in the file |

| Remote | Returns |
|---|---|
| `status()` | `{ state, detail?, drafts }` |
| `reconnect()` | The state after reconnecting |
| `decide(id, action, text?)` | Posts the draft, optionally edited, or discards it |

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`CrewSlack` is a `TypertRemoteService` under `crewSlack`. It reads the app token, bot token and owner id from the credential store as `CREW_SLACK_APP_TOKEN`, `CREW_SLACK_BOT_TOKEN` and `CREW_SLACK_OWNER_ID`, checks the bot token with `auth.test`, and opens a Socket Mode WebSocket from `apps.connections.open`. Every envelope is acknowledged at once; a closed socket reopens after 5 seconds, and a refused token retries after a minute.

`route` picks the member from the message's opening words and keeps a thread with its member; a thread that names a different member starts a new Session. The first message of a thread creates a Session with `ctx.sessionController.create` in the member's folder from crew-connections, and every message is admitted with `ctx.sessionController.prompt`, so the chat appears in dsh like any other. The service waits for the turn's `turn/end` and takes the last assistant text as the draft. `decide` is the only path that calls `chat.postMessage` for a thread; button clicks from anyone but the owner are ignored.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, Remote, Sessions and drafts |
| [`src/slack.ts`](src/slack.ts) | Web API calls, envelope parsing, routing and the approval card |
| [`src/types.ts`](src/types.ts) | Types shared with the browser |
| [`slack-app.yml`](slack-app.yml) | Slack app manifest |
| [`tests/`](tests/) | Parsing, routing, and the mention-to-post flow against fake Slack |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-agents-ui](../crew-agents-ui/README.md) — the Slack card in the Crew tab.
- [crew-roster](../crew-roster/README.md) — the members a message can name.
- [Slack Socket Mode](https://api.slack.com/apis/socket-mode).

<a id="model-experience"></a>
## Model Experience

### Slack prompt

#### What the model sees

Each Slack message reaches the member's Session as an ordinary user message:

##### Slack message

```markdown
Slack message from <@U012345> in <#C012345>:

why is CI red?

Reply the way you would in Slack to a teammate: short, plain sentences, no headings or reports. The user approves your reply before it is posted, so write only the message itself.
```

#### Token effect

About 60 tokens around each Slack message; the reply is read from the turn, not sent back to the model.

#### KV Cache effect

Each Slack message is appended to the Session like a typed message, so earlier turns stay a stable prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Answers arrive only while this computer is awake and dsh is running; Slack keeps nothing for later.
- Channel messages need an `@Crew` mention; follow-ups in a thread without one are not seen.
- Editing happens in the Crew tab; the Slack card offers Post reply and Discard only.
- Files and images in Slack messages are not passed on.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests replace `internals.fetch` and `internals.WebSocket`; no request leaves the machine.

</details>
