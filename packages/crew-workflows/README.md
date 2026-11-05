---
description: "Crew workflows: saved agentic and fixed workflows, a runner that hands work between crew members in stages, and a draft tool for agents."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-workflows

English | [中文](README.zh.md)

## Summary

A workflow is a list of steps saved on disk. An agentic workflow hands work between crew members; a fixed workflow runs tool calls only. Steps run in stages, in order, and a step marked `together` runs alongside the step before it. Each run gets a lead Session that the crew members work under, and the results of each stage go to the next. The `crewWorkflows` Remote saves, runs and cancels workflows for [crew-workflows-ui](../crew-workflows-ui/README.md). The `crew_workflow_draft` tool lets an agent propose a draft, which never runs until the user clicks Run.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this package with its home under `~/.dsh/crew`. Open **Workflows** below Automations in the sidebar, or ask a crew member to “set up a workflow that …”.

| Field | Default | Meaning |
|---|---|---|
| `homeDirectory` | required | Folder for `workflows.json` and the default working folder `workflows/` |
| `provider` | `spawn` | Subagent provider that runs crew member steps |
| `keepRuns` | `30` | Finished runs kept in the file |

| Remote | Returns |
|---|---|
| `state()` | `{ ok: true, value: { workflows, runs } }` |
| `save(definition)` | the saved definition with its id, or the problems that stop it |
| `deleteWorkflow(id)` | success; past runs stay listed |
| `run(id)` | the new run id; refuses drafts and invalid definitions |
| `cancel(runId)` | success, or that the run is not running |

A tool step runs through the ordinary tool pipeline as the lead Session, so approval prompts and the guard apply to it as to any other call.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`CrewWorkflows` is a `TypertRemoteService` under `crewWorkflows`. `problemsOf` checks a definition: a name, 1–24 steps, unique ids, crew presets (`crew-*`) for crew member steps, existing tool names for tool steps, and no crew member steps in a fixed workflow. `stagesOf` groups steps into stages.

`runWorkflow` creates the lead Session (preset `crew-chief` for agentic workflows, titled “Workflow: name”), then runs each stage with `Promise.all`. A crew member step starts through `ctx.subagents.startActivation` with delivery to the caller; its prompt ends with a “Results from earlier steps” section capped at 12,000 characters. A failed step marks the run failed and later steps skipped; cancelling aborts every running step. Outputs are kept up to 4,000 characters. Every change is written to `workflows.json` atomically with mode 0600; runs still marked running when dsh starts are marked cancelled.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, Remote, store and draft tool |
| [`src/runner.ts`](src/runner.ts) | Stages, handoff prompts, failure and cancel |
| [`src/validate.ts`](src/validate.ts) | Definition checks and stages |
| [`src/types.ts`](src/types.ts) | Types shared with the browser |
| [`tests/`](tests/) | Checks, stages, prompts and runs over fake Host operations |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-workflows-ui](../crew-workflows-ui/README.md) — the Workflows page.
- [Subagent](../../subagent/subagent/README.md) — how crew member steps start.
- [Tools](../../core/tools/README.md) — the pipeline tool steps run through.

<a id="model-experience"></a>
## Model Experience

### Workflow draft tool

#### What the model sees

The [`crew_workflow_draft` declaration](../../../docs/tool-catalog.md#deepseek-aidsh-crew-workflows) appears in every Session while the bundle is installed. A call saves a draft and returns one line: either that the draft was saved and the user should review and run it, or the draft id with the problems the user must fix first.

##### Result

```markdown
Saved draft wf-1a2b3c4d. Tell the user to review it on the Workflows page and click Run when it looks right.
```

#### Token effect

The declaration is about 200 tokens on every request; each call adds about 40 tokens of result. Crew member steps run in their own Sessions and add nothing to the caller's history.

#### KV Cache effect

The declaration is fixed while the bundle is installed, so it keeps the request prefix stable. Runs and page actions add nothing to the caller's model history.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Runs live in the dsh process; quitting dsh cancels them, and a cancelled run cannot be resumed.
- The draft tool is registered for every Session, not only crew presets.
- Results passed between stages are text only, cut at 12,000 characters.
- There is no schedule trigger; use Automations to start a Session that asks for a run.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The runner takes its Host operations as `RunnerDeps`, so the tests drive it without dsh. Keep `problemsOf` messages in plain English; the editor shows them as they are.

</details>
