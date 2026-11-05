---
description: "Chain-of-thought card in the chat: each Turn's reasoning, tool calls, timings and sources, live while the Turn runs."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-chain-of-thought

English | [中文](README.zh.md)

## Summary

Long agent turns hide their work between the question and the answer. This client plugin adds a card at the start of every Turn that reasons or calls tools: one row per step, showing the first line of each reasoning block, each tool call with the argument that names it, how long it took, whether it failed and which link hosts its result contained. While the Turn runs the card is open with a live **Working** timer; when it ends it collapses to one line that expands on click.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this plugin; it needs no configuration and shows in every Session. A Turn without reasoning or tool calls gets no card.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A conversation Definition matches `turn/start`, `assistant/message`, `tool/call`, `tool/result` and `turn/end` by Turn and folds them into `{ turn, startedAt, endedAt?, steps }`. It publishes a `crew-chain` Chat node anchored at the Turn's start, rendered through the keyed `conversation.chat.node` slot. The detail is the first of `query`, `url`, `command` and similar string arguments; sources are the distinct hosts of http(s) links in the result text, at most six. Everything is read from the Session log, so replay rebuilds the card.

| Source | Contents |
|---|---|
| [`src/client/chain.ts`](src/client/chain.ts) | Turn Definition and folding |
| [`src/client/ChainCard.tsx`](src/client/ChainCard.tsx) | Card |
| [`src/client/index.ts`](src/client/index.ts) | Registrations |
| [`tests/`](tests/) | Folding and card states |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-workflow-run](../../client/ui-workflow-run/README.md) — the Chat node pattern this follows.
- [ui-trajectory](../../client/ui-trajectory/README.md) — the full timing inspector.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser card that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The card repeats tool rows the chat already shows; it summarises rather than replaces them.
- Sources are link hosts found in result text, not a citation list the tool declared.
- Reasoning appears only when the model returns reasoning blocks.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests fold synthetic events with the real event shapes and render the card with fake timers for the live clock.

</details>
