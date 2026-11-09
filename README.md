# Crew — multi-agent orchestration for DeepSeek Harness

[![npm](https://img.shields.io/npm/v/dsh-agent-crew.svg)](https://www.npmjs.com/package/dsh-agent-crew)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness plugin](https://img.shields.io/badge/dsh-plugin-4D6BFE.svg)](https://github.com/deepseek-ai/deepseek-harness)

**Crew** is an agent orchestrator plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh). A **Chief of staff** agent plans the work, splits it into tasks, and hands each task to a specialist subagent: Mail, Chat, Code, Research, Life or Design. You watch them work live and step in whenever you want.

Nothing irreversible happens without you. Every send, post, purchase, delete, merge or booking waits for your click on an approval card.

```sh
dsh plugin --profile web add dsh-agent-crew
```

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
| **Preset gallery** | Add ready-made members in one click: Analyst, Writer, Editor, Fact-checker, Devil's advocate, Tutor, Markets and Product manager. Adjust any of them before saving; the Chief of staff can call them once added. |
| **Own chats** | Each member keeps one chat of its own, in its own folder, so you can talk to it without picking a workspace. The Crew tab always takes you back to it. |
| **Live web and X** | Members with web access search before answering anything time-sensitive, including recent posts on x.com, and cite each source with its date. |
| **Heavy mode** | For a hard question, or whenever you say "heavy", the Chief of staff asks two to four teammates the same question in parallel and combines their answers, noting where they disagree. |
| **Your workspaces** | Members with file access list your workspaces with `crew_workspaces`, read files in any of them and enter one with `working_directory`. Changes outside a member's own folder ask you first. |

## Install

Requires [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) with a `web` profile.

Install [`dsh-agent-crew`](https://www.npmjs.com/package/dsh-agent-crew) from npm:

```sh
dsh plugin --profile web add dsh-agent-crew
```

Each release on [GitHub](https://github.com/tusharcora/dsh-agent-crew/releases) also carries the package tarballs. To change Crew itself, [build it from source](#develop-from-source).

After installing, restart dsh, open **Plugins** and enable **Crew**.

### Compatibility

Crew is built against dsh `>=0.2.2-rc.1 <0.3.0`. A few parts need core features that stock dsh doesn't have yet. Crew still installs and runs without them:

| Feature | On a dsh with the feature | On stock dsh 0.2.2-rc.1 |
| --- | --- | --- |
| Crew sidebar section | Members listed in the left sidebar | Open members from the **Crew** tab in the right panel |
| A member's own chat | Opens in the member's own folder, ready to type | Opens in your most recent workspace |
| Member chats in the sidebar | Shown only in the Crew section and tab | Also listed under **Ungrouped** |
| **Board** tab | Moves Team tasks between columns | Waits for dsh's agent-team service, which stock dsh doesn't ship |

Everything else (Handoffs, Tools, Chain of thought, Workflows, Today, Desktop, Slack, the roster and learning) works on stock dsh.

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

1. Click **Chief of staff** in the Crew sidebar section (or the **Crew** tab on stock dsh).
2. Ask for something that needs more than one skill:
   > Research the three best-rated open-source vector databases, compare them in a table, and draft an email to my team with a recommendation.
3. Open the **Board** and **Handoffs** tabs to watch the Chief of staff split the work between Research and Mail.
4. The finished draft appears as an approval card. Nothing is sent until you click **Send**.

A member's own chat runs in that member's own directory, so you can start typing right away (see [Compatibility](#compatibility) for stock dsh). To work inside a project, open the member's menu, choose **New chat in…** and pick a workspace.

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

## Releasing

Crew is published as 20 unscoped packages: `dsh-agent-crew` (the bundle users install) and one `dsh-agent-crew-<name>` per package. They all share one version, set in the root [`package.json`](package.json).

After building the dsh checkout, stage and pack them:

```sh
node scripts/pack.mjs ../deepseek-harness/packages/experimental
```

This copies each built package to `dist/packages/`, renames `@deepseek-ai/dsh-crew-*` to `dsh-agent-crew-*`, and replaces `workspace:` specs with real ranges:

- dsh core: `>=0.2.2-rc.1 <0.3.0`, as optional peers, because dsh supplies its own packages at runtime
- `cordis` `~4.1.0`, `schemastery` `~3.19.0` and `cordis-plugin-include` `~1.1.0`, the versions dsh 0.2.2-rc.1 uses
- crew packages: the exact shared version

Tarballs land in `dist/tarballs/`. Add `--publish` to publish them all, with the bundle last. Run `npm test` to check the staging rules.

### From GitHub

[`publish.yml`](.github/workflows/publish.yml) does the same on GitHub Actions, with [npm provenance](https://docs.npmjs.com/generating-provenance-statements): each version's npm page then links to the commit and run that built it.

1. Bump `version` in the root `package.json` and push.
2. Publish a GitHub release tagged `v<version>`. The workflow builds against the `crew/slack` branch of the dsh fork and publishes.

Run the workflow by hand to build and pack without publishing. It needs an `NPM_TOKEN` repository secret: an npm granular token with read and write on all packages and "bypass 2FA".

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
