---
description: "Crew roster: the crew members, stored on disk and registered as agent presets, with a Remote to add, edit and remove them."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-roster

English | [中文](README.zh.md)

## Summary

Keeps the crew in `members.json` and registers one agent preset per member. A member record holds a name, a one-line role, instructions, a face, abilities (files, commands, web pages, scheduled tasks) and connections; the preset is built from it. On first run the file is seeded with Chief of staff and the five specialists. The lead's `ask_*` delegation tools and roster lines follow every change. [crew-agents-ui](../crew-agents-ui/README.md) edits members through the `crewRoster` Remote.

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

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`CrewRosterService` is a `TypertRemoteService` under `crewRoster`. `presetFor(member, crew)` builds the preset rows; for the lead it appends one roster line per other member to the instructions and mounts one `dsh-tool-subagent` per other member with `provider: spawn`, `toolName: ask_<letters>` and that member's preset. A change writes `members.json` atomically with mode 0600, then disposes and registers the presets it touches and the lead's. The agent preset registry keeps existing Agents on the composition they started with. An unreadable file is left as it is and the shipped crew runs until it is fixed.

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

A Session running a member's preset sees that member's instructions at the start of the system prompt, with `{{model}}` resolved, and the tools its abilities and connections add, reached through `run_code`. The lead's instructions end with one line per other member, such as:

##### Lead roster lines

```markdown
Your crew, and the tool that asks each one:
- ask_mail: Mail. Reads and triages email and drafts replies for your approval.
```

#### Token effect

The instructions cost what the user writes, usually 60 to 160 words. The lead adds about 20 tokens per roster line and one delegation declaration per member.

#### KV Cache effect

Prefix-stable until a member is edited: a change alters the system prompt and tools of that member's new chats, and the lead's. Running chats keep the preset they started with.

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
