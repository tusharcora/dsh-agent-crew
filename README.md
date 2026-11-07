# dsh-crew

**Crew** is a plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) that gives you a crew of agents. A Chief of staff plans the work and hands it to the Mail, Chat, Code, Research, Life and Design specialists. You watch and steer them from the Board, Handoffs, Desktop and Tools tabs and the Workflows and Today pages.

Anything that sends, posts, buys, deletes, merges or books waits for your click on an approval card.

## What's in it

The plugin is one bundle, [`crew-agents`](packages/crew-agents) (shown as **Crew** on the Plugins page). It mounts the other 19 packages:

| Package | What it does |
| --- | --- |
| [crew-agents](packages/crew-agents) | The **Crew** bundle: the shipped members and every crew page |
| [crew-roster](packages/crew-roster) | Crew members stored on disk and registered as agent presets; add, edit and remove them |
| [crew-agents-ui](packages/crew-agents-ui) | The Crew sidebar section with each member's face and live status |
| [crew-faces](packages/crew-faces) | SVG faces for crew members |
| [crew-connections](packages/crew-connections) | Google sign-in for Gmail and Calendar, token refresh, and the write guard |
| [crew-improve](packages/crew-improve) | Lessons proposed from your ratings and corrections, added after you approve them |
| [crew-slack](packages/crew-slack) | Mention the crew in Slack; every reply waits for your approval |
| [crew-kanban](packages/crew-kanban), [crew-kanban-ui](packages/crew-kanban-ui) | The **Board** tab for a Session's Team tasks |
| [crew-handoff-ui](packages/crew-handoff-ui) | The **Handoffs** tab: which agents got which work |
| [crew-tool-map-ui](packages/crew-tool-map-ui) | The **Tools** tab: each agent's tool access and calls |
| [crew-chain-of-thought](packages/crew-chain-of-thought) | A card in the chat with each turn's reasoning, tool calls and sources |
| [crew-workflows](packages/crew-workflows), [crew-workflows-ui](packages/crew-workflows-ui) | The **Workflows** page: a drag-and-drop builder, runs and run timelines |
| [crew-desktop](packages/crew-desktop), [crew-desktop-ui](packages/crew-desktop-ui) | The **Desktop** tab: the latest screen an agent saw, with Pause and Take over |
| [crew-today](packages/crew-today), [crew-today-ui](packages/crew-today-ui) | The **Today** page: approvals, the crew, your calendar and open pull requests |
| [crew-stock-chart](packages/crew-stock-chart), [crew-stock-chart-ui](packages/crew-stock-chart-ui) | A stock chart tool and card over Yahoo Finance |

Each package has its own README.

## Build and install

The packages depend on core dsh packages through `workspace:*`, so they build inside a dsh checkout, not on their own. They are developed in [tusharcora/deepseek-harness](https://github.com/tusharcora/deepseek-harness) under `packages/experimental/`.

1. Clone that fork and copy (or link) these packages into `packages/experimental/`.
2. Run `pnpm install` and `pnpm run build` at the repository root.
3. Add the bundle to a dsh profile, for example:

   ```sh
   dsh plugin --profile web add link:/path/to/deepseek-harness/packages/experimental/crew-agents
   ```

   then list `@deepseek-ai/dsh-crew-agents` under `dsh.profile.bundles` in the profile's `package.json`.

Design uses the `web-artifact-designer` skill from `dsh-web-artifact-designer`; install it in the same profile.

## History

This repository was split from the fork with its full commit history for these packages. Paths moved from `packages/experimental/crew-*` to `packages/crew-*`.

## License

MIT. See [LICENSE](LICENSE).
