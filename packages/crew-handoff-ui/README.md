---
description: "Handoffs tab: agent cards with live state and lanes of the tasks a Session handed to each subagent, shared with other crew pages."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-handoff-ui

English | [中文](README.zh.md)

## Summary

When a Session delegates, the work moves out of sight. This client plugin adds a **Handoffs** tab to the right panel: one card for the Session and one for each subagent it created, with the crew member's face and name, its preset, whether it is working, waiting on you or idle, and the task it is on. Below the cards, one lane per agent lists every task handed to it, newest first, with the short task label, the first line of the brief, when it was handed off and through which tool. Other crew pages reuse the view through `ctx.crewHandoffs`.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this plugin. Open **Handoffs** from the right panel's guide in any Session; a card opens that agent's Session. The newest item in a lane reads **With** the agent while it works or waits on you, and **Handed back** once it is idle.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A handoff is a successful tool result whose presentation metadata is `{ kind: 'activation', name }`, which every subagent delegation tool returns; its `tool/call` gives the `description`, `prompt` and `agent_preset` arguments. The tab reads the Session's loaded event window, its `subagentCatalog` projection for the children, and the Session list and status for each card's preset and state.

| Source | Contents |
|---|---|
| [`src/client/handoffs.ts`](src/client/handoffs.ts) | Reading handoffs from events |
| [`src/client/view.ts`](src/client/view.ts) | Cards and lanes |
| [`src/client/HandoffView.tsx`](src/client/HandoffView.tsx) | View |
| [`src/client/HandoffTab.tsx`](src/client/HandoffTab.tsx) | Tab body |
| [`src/client/index.ts`](src/client/index.ts) | Registrations and `ctx.crewHandoffs` |
| [`tests/`](tests/) | Reading, building and drawing |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [tool-subagent](../../subagent/tool-subagent/README.md) — the delegation tools.
- [ui-subagent](../../client/ui-subagent/README.md) — the subagent tree in the Session header.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser view that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Cost per agent is not shown; dsh records token usage, not prices.
- Only handoffs in the loaded part of the Session log appear.
- Handoffs between subagents appear in the delegating subagent's own Session, not the lead's.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests read synthetic events with the real event shapes and render the view from a built model.

</details>
