---
description: "Workflows page below Automations: build agentic and fixed workflows in a form, run them, and follow each run by step state and handoff."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-workflows-ui

English | [中文](README.zh.md)

## Summary

Adds **Workflows** to the sidebar, directly below Automations. The page lists saved workflows and drafts that agents proposed. The editor builds either kind: crew member steps with a member, task and instructions, and tool steps with a tool name and JSON input. Steps can move up and down or run together with the step before. Run is enabled only for a saved, unchanged workflow. Each run shows its steps in Waiting, Running, Done, Failed and Skipped columns, with outputs. Agentic runs embed the shared handoff view from [crew-handoff-ui](../crew-handoff-ui/README.md).

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

Install the [crew-agents](../crew-agents/README.md) bundle; it mounts this package with [crew-workflows](../crew-workflows/README.md). Click **New agentic workflow** or **New fixed workflow**, add steps, then **Save** and **Run**. **Open the lead Session** shows the run as a chat. Delete asks once more before removing a workflow.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin mounts the `crew-workflows/remote` Remote, then registers a `main` page and a `sidebar.panellist` entry with order 11 (Automations is 10). The page re-reads `state()` every 2 seconds while a run is running and every 15 seconds otherwise. Crew member names come from `ctx.crew`; the handoff view and its helpers come from `ctx.crewHandoffs`. `handoffData` turns a run into handoff cards: the lead, and one card per crew member step that has started.

| Source | Contents |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Remote mount, page and sidebar entry |
| [`src/client/WorkflowsPage.tsx`](src/client/WorkflowsPage.tsx) | List, editor and runs |
| [`src/client/Editor.tsx`](src/client/Editor.tsx) | The workflow form |
| [`src/client/RunView.tsx`](src/client/RunView.tsx) | Step columns and handoffs |
| [`tests/`](tests/) | Editor, run view and handoff data |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-workflows](../crew-workflows/README.md) — storage, the runner and the draft tool.
- [crew-handoff-ui](../crew-handoff-ui/README.md) — the shared handoff view.

<a id="model-experience"></a>
## Model Experience

None, as this package edits and follows workflows through a Remote and adds no model input or Session events.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Tool steps take raw JSON input; there is no form per tool schema.
- Steps reorder with buttons, not drag and drop.
- The page polls instead of subscribing to changes.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Copy lives in `src/client/locales.ts` under the `crewWorkflows` namespace.

</details>
