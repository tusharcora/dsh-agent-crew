---
description: "Crew agent presets: Mail, Chat, Code, Research and Life specialists, each with its own persona and tools, and a Chief of staff that delegates to them."
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-crew-agents

English | [中文](README.zh.md)

## Summary

The crew is six agent presets. Five specialists each have their own persona and tools: Mail, Chat, Code, Research and Life. Chief of staff plans the work and hands each piece to a specialist through its own `ask_*` delegation tool. The bundle also mounts the agent faces and the browser roster, whose right-panel **Crew** tab shows each member's face, name and live status.

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

Install the bundle from the Plugins page or with `dsh plugin`. Start a Session and pick a crew preset in the preset menu, or open Chief of staff and ask for an outcome; it delegates to the specialists.

| Preset | Tools | Writes |
|---|---|---|
| `crew-chief` Chief of staff | `ask_mail`, `ask_chat`, `ask_code`, `ask_research`, `ask_life`, subagent controls, questions, todo | Nothing directly |
| `crew-mail` Mail | Web search and fetch, read-only files, questions, todo | Nothing |
| `crew-chat` Chat | Web search and fetch, questions | Nothing |
| `crew-code` Code | Shell, files, file search, jobs, web, questions, todo | Workspace files and commands |
| `crew-research` Research | Web search and fetch, read-only files, file search, todo | Nothing |
| `crew-life` Life | Schedule, web search and fetch, questions, todo | Reminders, after the user agrees |

### Model per specialist

A preset cannot select a model, so each specialist's model is the `agentOptions` of its `ask_*` row in the Chief preset. The shipped rows leave it unset, so a specialist uses its Session's model. To pin one, add `agentOptions` with `provider` and `model` to that row in your profile patch; `list_subagent_models` lists the routes the deployment offers.

### Agent Teams

The Chief uses the Agent Teams task board when Team mode is on for its Session. Turn on **Use Agent Teams** in the Chief Session's model menu, or set `defaultEnabled: true` on the `agent-team` row to enable it for every new root Session.

### Code mode and MCP servers

Every crew preset mounts `dsh-tool-executor-ptc`, so the model reaches its tools, MCP ones included, through one `run_code` program instead of a tool call per step; intermediate results stay in the program and out of the conversation. Each specialist has its own MCP servers; secrets come from the credential store through `${credential:REF}` templates, and a server whose credential is missing waits instead of failing:

| Member | Servers |
|---|---|
| Mail | Gmail (Google MCP, developer preview) |
| Chat | Slack (off until approved) |
| Code | GitHub (official remote server, read-only mode), Cloudflare docs |
| Research | Firecrawl (keyless), Cloudflare docs, Exa (off until approved) |
| Life | Google Calendar (Google MCP, developer preview), Obsidian vault (off until approved) |

Connect accounts from the **Connections** list in the Crew tab; [crew-connections](../crew-connections/README.md) owns the Google sign-in.

### Approvals

Every preset mounts the crew write guard, which refuses MCP tools that would send, post, buy, delete, merge or book, in direct calls and inside `run_code`. Gmail drafts are allowed and wait for the user. Approval cards that perform such actions after a click arrive with crew-today.

### Learning

Every preset also reads its own approved lessons. After you rate a crew member's message or correct it in a chat, [crew-improve](../crew-improve/README.md) proposes lessons for that member; approve or reject them in the Crew tab's **Learning** list. Lessons change only what the member is told, never its tools, accounts or the write guard.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

[`cordis.patch.yml`](cordis.patch.yml) inserts the face and browser roster rows and six `dsh-agent-preset` rows. The Chief mounts one `dsh-tool-subagent` instance per specialist with `provider: spawn`, a distinct `toolName` and a fixed `agentPreset`, so each delegation has its own tool and its own model setting. Specialists mount no delegation tool, so delegation stops at depth one.

| Source | Contents |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | Preset rows, personas, code mode, write guard and MCP rows |
| [`tests/bundle.spec.ts`](tests/bundle.spec.ts) | Layer contents, dependencies, every child row's config under its package schema, delegation and write access |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-agents-ui](../crew-agents-ui/README.md) and [crew-faces](../crew-faces/README.md) — the browser roster and faces this bundle mounts.
- [agent-preset](../../preset/agent-preset/README.md) and [persona](../../preset/persona/README.md) — preset rows and personas.
- [tool-subagent](../../subagent/tool-subagent/README.md#selecting-a-child-preset) — child presets and models.
- [agent-team](../../team/agent-team/README.md) — Team mode and the task board.

<a id="model-experience"></a>
## Model Experience

### Crew personas

#### What the model sees

Each preset's `dsh-persona` row replaces the deployment persona prefix with that member's text and an empty suffix; `{{model}}` resolves to the Session's model. The specialist personas in [`cordis.patch.yml`](cordis.patch.yml) state the member's role, what it may change, and that it never sends, posts, buys, deletes, merges or books by itself. The Chief's persona reads:

##### Chief of staff persona

```markdown
You are the user's chief of staff, powered by the {{model}} model. You lead a crew of five specialists and own the plan, not the details.
Delegate each piece of work to the specialist that fits with its ask_* tool: ask_mail for email, ask_chat for messages, ask_code for repositories and pull requests, ask_research for questions that need sources, ask_life for calendar, errands and reminders. Give each one a self-contained task with the outcome you need.
When Agent Teams is on, put multi-step work on the task board and assign each task to the specialist doing it.
Nothing is sent, posted, bought, deleted, merged or booked without the user's explicit approval. Report what each specialist found, with its sources, and say clearly what still needs the user.
```

#### Token effect

Each persona is 60 to 160 words on every request of its preset's Sessions, replacing the deployment persona prefix and suffix.

#### KV Cache effect

Prefix-stable while the persona text and the resolved model are unchanged. The persona sits at the start of the system prompt, so editing it invalidates the cached prefix of that preset's Sessions only.

### Code mode and MCP tools

#### What the model sees

The [`run_code` declaration](../../../docs/tool-catalog.md#deepseek-aidsh-tool-executor-ptc) replaces the individual tool declarations of every crew preset; its generated SDK lists the preset's tools, including each connected MCP server's tools as `mcp__<server>__<tool>`. Connected servers' instructions join the system prompt as literal text.

#### Token effect

One `run_code` declaration and its SDK listing replace the per-tool schemas; a multi-step task costs one call and one result instead of one per step. Each connected server adds its tool descriptions to the SDK listing and its instructions, up to 32 KB, to the prompt.

#### KV Cache effect

The SDK listing changes when a server connects, disconnects or changes its tools, which changes the request prefix for that preset's Sessions; otherwise it is stable.

### Delegation tools

#### What the model sees

The Chief sees five [`subagent` declarations](../../../docs/tool-catalog.md#deepseek-aidsh-tool-subagent) named `ask_mail`, `ask_chat`, `ask_code`, `ask_research` and `ask_life`, each starting a child with its fixed preset, plus the subagent control tools. No row sets `allowedAgentPresets`, so no declaration carries an `agent_preset` field.

#### Token effect

Five delegation declarations on every Chief request. Specialists carry none.

#### KV Cache effect

The declarations are fixed for the Chief preset and keep the request prefix stable across its turns.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Mail and Chat have no mailbox or chat account until account connectors are added, so they can only work from what the user provides and the web.
- A specialist's model is set per delegation row, not per preset, so a Session opened directly on a specialist preset uses its own Session model.
- Team mode is a per-Session choice; the Chief does not turn it on by itself.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The bundle test validates each child row against its package's exported `Config` schema; it caught missing required fields that the Loader would otherwise reject only at preset mount.

</details>
