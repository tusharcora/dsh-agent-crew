---
description: "Board tab for a Session's Team tasks: four columns with cards you drag or move from a detail panel, shared with other crew pages."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-kanban-ui

English | [中文](README.zh.md)

## Summary

A Team's task board is easier to follow as columns. This client plugin adds a **Board** tab to the right panel that shows the current Session's Team tasks in Blocked, To do, In progress and Done, with each card's id, subject, owner, blockers and write scopes. Drag a card to another column, or open it and choose **Move to**; the move goes through [crew-kanban](../crew-kanban/README.md) and a status line says whether it worked. Other crew pages reuse the board through `ctx.crewBoards`.

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

Open **Board** from the right panel's guide in a Session with **Use Agent Teams** on; without it the tab says how to turn it on. A blocked card cannot move, and the columns a card can move to light up while you drag it. `ctx.crewBoards` provides `Board` and `moveFor(sessionId)`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The tab reads the Session's `agentTeam` projection, so the board updates as members change tasks. Cards drag with the HTML drag and drop API and carry their id and column; a drop on a column the rules do not allow is ignored. The detail panel offers the same moves as buttons for keyboard and screen-reader users. The browser keeps a copy of the column rules, pinned to the Host's by a test, and the Host still validates every move.

| Source | Contents |
|---|---|
| [`src/client/KanbanBoard.tsx`](src/client/KanbanBoard.tsx) | Board, cards and detail panel |
| [`src/client/BoardTab.tsx`](src/client/BoardTab.tsx) | Tab body |
| [`src/client/moves.ts`](src/client/moves.ts) | Browser copy of the column rules |
| [`src/client/index.ts`](src/client/index.ts) | Registrations and `ctx.crewBoards` |
| [`tests/`](tests/) | Board states, moves and rule parity |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-kanban](../crew-kanban/README.md) — the move Remote.
- [ui-agent-team](../../client/ui-agent-team/README.md) — the compact task list in the Session header.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser board that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only the Team Lead Session's board can move cards.
- There is no undo; move the card back instead where the rules allow.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests render the board from a projection fixture and drive moves through the detail panel and through drag and drop.

</details>
