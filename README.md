# Crew — multi-agent orchestration for DeepSeek Harness

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness plugin](https://img.shields.io/badge/dsh-plugin-4D6BFE.svg)](https://github.com/deepseek-ai/deepseek-harness)

**Crew** is an agent orchestrator plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). A **Chief of staff** agent plans the work, splits it into tasks, and hands each task to a specialist subagent: Mail, Chat, Code, Research, Life or Design. You watch them work live and step in whenever you want.

Nothing irreversible happens without you. Every send, post, purchase, delete, merge or booking waits for your click on an approval card.

> **Status:** an npm release is coming soon. Until then, install Crew [from source](#develop-from-source).

---

## Why Crew

Most agent setups give you one agent holding every tool. Crew gives you a team.

- **One planner, many specialists.** The Chief of staff delegates to members scoped to one job, each with only the tools that job needs.
- **Full visibility.** A kanban board of tasks, a handoff view of who got what, a map of every tool call, and the reasoning behind each turn.
- **Human in the loop by design.** Agents propose actions and you approve them. The model never gets a tool that performs an irreversible action directly.
- **Learns from use.** Rate an answer or correct a member and Crew proposes a lesson. Approved lessons are added to that member's instructions.
- **Repeatable workflows.** Save a multi-agent run as a workflow, agentic (the lead picks the steps) or fixed (you do), and run it again.

## Features

| Surface | What you get |
| --- | --- |
| **Crew sidebar** | Every member with a face and live status: *idle*, *working* or *needs you*. One click opens that member's own chat. |
| **Board** | The session's team tasks in four columns. Drag cards yourself or let the lead move them. |
| **Handoffs** | Which agent got which task, with live state per lane. |
| **Tools** | Each agent's tool access, call counts and last call, with a read-only call inspector. |
| **Chain of thought** | A card in the chat with each turn's reasoning, tool calls, timings and sources. |
| **Workflows** | A drag-and-drop builder for agentic and fixed workflows, with a step-by-step timeline for every run. |
| **Today** | Pending approvals, crew status, a digest, this week's calendar and your open pull requests. |
| **Desktop** | The latest screen a computer-use agent saw, with **Pause** and **Take over**. |
| **Slack** | Mention the crew in Slack. Each member answers in its own dsh session, and every reply waits for approval. |
| **Roster** | Add, edit and remove members. Each is stored on disk and registered as a dsh agent preset. |

## Install

Requires [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) with a `web` profile.

**From npm (coming soon).** Crew isn't on npm yet. Once it is, installing will be a single `dsh plugin --profile web add` command. For now, [build it from source](#develop-from-source).

After installing, restart dsh, open **Plugins** and enable **Crew**. The Crew section appears in the sidebar.

The Design member uses the `web-artifact-designer` skill from `dsh-web-artifact-designer`. Install it in the same profile if you want Design:

```sh
dsh plugin --profile web add dsh-web-artifact-designer
```

### Optional connections

Crew works without any accounts. Connect them from the Crew tab when you want the matching tools:

- **Google**: Gmail and Calendar, for the Mail and Life members and the Today page.
- **GitHub**: your open pull requests on the Today page.
- **Slack**: mention the crew from a Slack channel.

Credentials are kept in dsh's credential store, never in plugin files.

## Quick start

1. Click **Chief of staff** in the Crew sidebar section.
2. Ask for something that needs more than one skill:
   > Research the three best-rated open-source vector databases, compare them in a table, and draft an email to my team with a recommendation.
3. Open the **Board** and **Handoffs** tabs to watch the Chief of staff split the work between Research and Mail.
4. The finished draft appears as an approval card. Nothing is sent until you click **Send**.

A member's own chat runs in that member's own directory, so you can start typing right away. To work inside a project, open the member's menu, choose **New chat in…** and pick a workspace.

## How it works

```text
                 ┌──────────────────┐
   you ───────▶  │  Chief of staff  │   plans, delegates, reviews
                 └────────┬─────────┘
       ┌────────┬─────────┼─────────┬─────────┬─────────┐
       ▼        ▼         ▼         ▼         ▼         ▼
     Mail     Chat      Code    Research    Life     Design    specialists, scoped tools
       └────────┴─────────┴────┬────┴─────────┴─────────┘
                               ▼
                     approval cards ──▶ your click ──▶ the action runs
```

- Each member is a dsh **agent preset** with its own persona, model and tools.
- The Chief of staff delegates through dsh's subagent and agent-team tools, and only to presets on the crew allowlist.
- Status is read from each session: an open turn means *working*; an unanswered question or an unclicked action card means *needs you*.
- Irreversible actions are action cards whose handler runs only when you click.

## Packages

Crew installs as one bundle, [`crew-agents`](packages/crew-agents), which mounts the rest.

| Package | What it does |
| --- | --- |
| [crew-agents](packages/crew-agents) | The **Crew** bundle: the shipped members and every crew page |
| [crew-roster](packages/crew-roster) | Members stored on disk and registered as agent presets |
| [crew-agents-ui](packages/crew-agents-ui) | The Crew sidebar section with faces and live status |
| [crew-faces](packages/crew-faces) | SVG faces derived deterministically from each member's id |
| [crew-connections](packages/crew-connections) | Google and GitHub sign-in, token refresh and the write guard |
| [crew-improve](packages/crew-improve) | Lessons from your ratings and corrections, applied after you approve them |
| [crew-slack](packages/crew-slack) | Slack mentions; every reply waits for approval |
| [crew-kanban](packages/crew-kanban), [crew-kanban-ui](packages/crew-kanban-ui) | The **Board** tab |
| [crew-handoff-ui](packages/crew-handoff-ui) | The **Handoffs** tab |
| [crew-tool-map-ui](packages/crew-tool-map-ui) | The **Tools** tab |
| [crew-chain-of-thought](packages/crew-chain-of-thought) | The chain-of-thought card in the chat |
| [crew-workflows](packages/crew-workflows), [crew-workflows-ui](packages/crew-workflows-ui) | The **Workflows** page and its runner |
| [crew-desktop](packages/crew-desktop), [crew-desktop-ui](packages/crew-desktop-ui) | The **Desktop** tab |
| [crew-today](packages/crew-today), [crew-today-ui](packages/crew-today-ui) | The **Today** page |
| [crew-stock-chart](packages/crew-stock-chart), [crew-stock-chart-ui](packages/crew-stock-chart-ui) | A stock chart tool and card over Yahoo Finance |

Each package has its own README.

## Develop from source

The packages build inside a DeepSeek Harness checkout. They are developed in [tusharcora/deepseek-harness](https://github.com/tusharcora/deepseek-harness) under `packages/experimental/`.

```sh
git clone https://github.com/tusharcora/deepseek-harness
cd deepseek-harness
pnpm install
pnpm run build
dsh plugin --profile web add link:$PWD/packages/experimental/crew-agents
```

Run one package's tests:

```sh
pnpm vitest run packages/experimental/crew-roster
```

## Safety model

- Nothing sends, posts, buys, deletes, merges or books without your click.
- Credentials go only through dsh credential references and authorization flows.
- Every price, score or date shows its source and when it was fetched. Sample data is labelled.
- The Chief of staff can delegate only to crew presets.

## Contributing

Issues and pull requests are welcome. For a large change, open an issue first so we can agree on the approach. Keep each change to one package where you can, and add or update its tests.

## History

This repository was split from the fork with the full commit history of these packages. Paths moved from `packages/experimental/crew-*` to `packages/crew-*`.

## License

[MIT](LICENSE)
