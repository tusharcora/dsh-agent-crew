---
description: "Crew roster: the crew members, stored on disk and registered as agent presets, with a Remote to add, edit and remove them."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-roster

English | [中文](README.zh.md)

## Summary

Keeps the crew in `members.json` and registers one agent preset per member, built from its name, role, instructions, face, abilities and connections. The file starts with Chief of staff and six specialists. Every member can hand work to any teammate with `ask_crew`, load installed skills, and add a teammate with `crew_member_create`, limited to abilities the crew already has. [crew-agents-ui](../crew-agents-ui/README.md) edits members through the `crewRoster` Remote.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this package with its home under `~/.dsh/crew`. Edit members in the **Crew** tab.

| Field | Default | Meaning |
|---|---|---|
| `homeDirectory` | required | Folder for `members.json` |

| Remote | Returns |
|---|---|
| `state()` | `{ members, connections }`: the records and the services a member can connect to |
| `saveMember(member)` | The saved record, or the problems that stop it. An empty id adds a member whose id is `crew-` and the name's letters |
| `deleteMember(id)` | Success; the lead cannot be removed |

Every member gets the time context, `run_code`, the crew write guard, its approved lessons, questions and a todo list. Abilities add file tools (read-only or full), shell with background jobs and repository instructions, web fetch, or the schedule tools. Connections add MCP rows that read secrets through `${credential:…}`; a connection whose account is not approved yet (Slack, Exa, Obsidian) keeps its row switched off. A crew has at most 16 members.

Every member also gets `ask_crew`, one [`subagent` declaration](../../subagent/tool-subagent/README.md) whose `agent_preset` lists its teammates, with the subagent control tools; delegation goes at most two levels deep from the chat you started. `crew_member_create` adds a member for an agent: abilities and connections no member has are left out and named in the result, the Crew tab shows who added it, and `first_task` starts it at once as a child of the calling chat. A shipped member added in a later version joins an existing crew once; one you removed is not added back.

A member can have a tool-call budget, `maxToolCalls`, set in the editor or by `crew_member_create`'s `max_tool_calls`. It counts every tool call the member makes while answering one message, calls inside `run_code` included, and resets when the next message starts. Once it is used up, further calls are refused before they run with a note telling the member to answer with what it has; `ask_user_question` stays allowed. No shipped member has a budget.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`CrewRosterService` is a `TypertRemoteService` under `crewRoster`. `presetFor(member, crew)` builds the preset rows: it appends one line per teammate to the instructions and mounts `dsh-tool-subagent` as `ask_crew` with `provider: spawn`, `allowedAgentPresets` set to the teammates and `maxDepth: 2`. `capAbilities` limits a created member to the crew's abilities and approved connections. The budget is a `tools/pre-execute` gate that counts calls per Session and clears the count on `turn/start` and `session/disposed`. A change writes `members.json` atomically with mode 0600, then disposes and registers every member's preset, since each lists its teammates. The file records the shipped ids it was offered, so `migrate` adds a newly shipped member once and replaces shipped instructions the user never edited. The agent preset registry keeps existing Agents on the composition they started with. An unreadable file is left as it is and the shipped crew runs until it is fixed.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, store and Remote |
| [`src/compose.ts`](src/compose.ts) | Record checks, ids and preset rows |
| [`src/defaults.ts`](src/defaults.ts) | Shipped members and connection catalog |
| [`src/types.ts`](src/types.ts) | Types shared with the browser |
| [`tests/`](tests/) | Checks, preset rows, and add, edit and remove against a fake registry |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-agents-ui](../crew-agents-ui/README.md) — the Crew tab editor.
- [agent-preset-registry](../../preset/agent-preset-registry/README.md) — how presets register.
- [crew-agents](../crew-agents/README.md) — the bundle.

<a id="model-experience"></a>
## Model Experience

### Member presets

#### What the model sees

A Session running a member's preset sees that member's instructions at the start of the system prompt, with `{{model}}` resolved, and the tools its abilities and connections add, reached through `run_code`. The instructions end with one line per teammate, such as:

##### Teammate lines

```markdown
Your teammates. Hand one a self-contained task with ask_crew, passing its id as agent_preset:
- crew-mail (Mail): Reads and triages email and drafts replies for your approval.
```

#### Token effect

The instructions cost what the user writes, usually 60 to 160 words, plus about 20 tokens per teammate line and one `ask_crew` declaration.

#### KV Cache effect

Prefix-stable until the crew changes: any change alters every member's teammate lines and `ask_crew` list for new chats. Running chats keep the preset they started with.

### Tool-call budget

#### What the model sees

A budgeted member sees nothing until its budget for the message is used up. Each call after that returns this refusal as the tool result:

##### Refusal

```markdown
Research has used its budget of 40 tool calls for this message. Stop calling tools and answer now with what you have, saying what is left undone.
```

#### Token effect

About 35 tokens per refused call; nothing while the budget lasts.

#### KV Cache effect

None; a refusal is an ordinary tool result appended to history.

### Create tool

#### What the model sees

The [`crew_member_create` declaration](../../../docs/tool-catalog.md#deepseek-aidsh-crew-roster) appears in every Session while the bundle is installed. A call returns one paragraph: the new member's id, anything not granted, and either how to ask it or its answer to the first task.

##### Result

```markdown
Added Designer as crew-designer. Not granted, because no member has it: slack. Ask it with ask_crew and agent_preset crew-designer in a new chat.
```

#### Token effect

The declaration is about 250 tokens on every request. A call adds about 40 tokens, plus the first task's answer when one is given.

#### KV Cache effect

The declaration is fixed while the bundle is installed. A created member changes the crew, and with it every member's prefix from its next new chat.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Removing a member leaves its past chats; they cannot start new turns once dsh restarts.
- A member's model cannot be chosen; it uses its Session's model.
- Connections are limited to the catalog in `src/defaults.ts`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`presetFor` takes the platform so tests can compose the bash and PowerShell rows for either; the bundle test in crew-agents validates the shipped presets against each package's config schema.

</details>
