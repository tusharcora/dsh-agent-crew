---
description: "Tools tab: each agent's tool access, call counts and last-call time, with a read-only inspector for every call, shared with other crew pages."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-tool-map-ui

English | [中文](README.zh.md)

## Summary

Which tools can each agent reach, and what did it do with them? This client plugin adds a **Tools** tab to the right panel. Pick the Session or one of its subagents: the agent sits between its tools, each marked with how often it was called and how long the last call took, **Not used yet**, or **No access** when another agent in the view has it and this one does not. Open a tool to see every call it made, with the input and the output side by side. Other crew pages reuse the map through `ctx.crewToolMaps`.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this plugin. Open **Tools** from the right panel's guide in any Session. The inspector is read-only: it shows calls but never runs one again.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A tool is available when the agent's newest `request/header` offered it, and used once the agent has called it, including calls made from a `run_code` program. **No access** compares the selected subagent with the Session. A subagent's history is loaded with `ctx.sessions.retain(id, { source: 'crewToolMap' })` only while it is selected and released when the selection changes.

| Source | Contents |
|---|---|
| [`src/client/tools.ts`](src/client/tools.ts) | Folding events and building one agent's map |
| [`src/client/ToolMapView.tsx`](src/client/ToolMapView.tsx) | Map and call inspector |
| [`src/client/ToolMapTab.tsx`](src/client/ToolMapTab.tsx) | Tab body and subagent loading |
| [`src/client/index.ts`](src/client/index.ts) | Registrations and `ctx.crewToolMaps` |
| [`tests/`](tests/) | Folding, access and the view |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-handoff-ui](../crew-handoff-ui/README.md) — which agents received which tasks.
- [ui-trajectory](../../client/ui-trajectory/README.md) — the full timing inspector.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser view that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No access** only compares against the Session and the selected subagent, not every agent in the tree.
- There is no Replay or Edit input; a call cannot be run again from the map.
- Only calls in the loaded part of each Session log appear.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests fold synthetic request headers and tool calls with the real event shapes and render the map and inspector.

</details>
