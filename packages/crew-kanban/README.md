---
description: "Crew kanban Host half: a Remote that moves a Team task between board columns as the Session's Team Lead."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-kanban

English | [中文](README.zh.md)

## Summary

The Board tab lets you move Team tasks by hand. This Host plugin turns a move between two board columns into the one Team task transition that matches it and applies it as the Session's Team Lead, through the same compare-and-set update the Team tools use. A move the board does not allow, a Session that is not the Lead, or a task that changed since the board drew it is refused with the reason.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this plugin beside [crew-kanban-ui](../crew-kanban-ui/README.md). The `crewKanban` Remote offers `move(sessionId, taskId, expectedRevision, from, to)`, returning `{ ok: true, revision }` or `{ ok: false, message }`.

| From | To | Team action |
|---|---|---|
| To do | In progress | `claim`: the Lead Session becomes the owner |
| In progress | To do | `release` |
| In progress | Done | `complete` |
| Done | To do | `reopen` |

Blocked cards cannot move until their dependencies finish.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Columns derive from task status and readiness: pending and not ready is Blocked, pending and ready is To do, `in_progress` is In progress and `completed` is Done. `move` checks the pair against the table, checks that the calling Agent is its own subagent root, and calls `ctx.agentTeams.updateTask` with the revision the board showed.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service and `move` Remote |
| [`src/moves.ts`](src/moves.ts) | Columns and allowed moves |
| [`src/types.ts`](src/types.ts) | Shared types |
| [`tests/`](tests/) | Columns, moves and refusals |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [agent-team](../../team/agent-team/README.md) — the task board and its transitions.
- [crew-kanban-ui](../crew-kanban-ui/README.md) — the Board tab.

<a id="model-experience"></a>
## Model Experience

None, as the package only moves Team tasks for the browser board and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Moves act as the Team Lead; a member Session's board is read-only.
- Reassigning to another member and editing task text are left to the Team tools.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests replace `agentTeams` and `subagents` with fakes and check the action, revision and refusals.

</details>
