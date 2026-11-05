---
description: "Crew learning: a reflector reads crew conversations and the user's ratings, proposes evidence-backed lessons for approval, and adds approved lessons to each member's system prompt."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-improve

English | [中文](README.zh.md)

## Summary

Crew members improve from the user's ratings and corrections. After the user rates a crew member's message, or sends a few more messages in a crew chat, a reflector reads the conversation and proposes up to three lessons for that member, each quoting its evidence. The user approves or rejects them in the Crew tab's **Learning** list, and approved lessons join the member's system prompt. The loop follows the experience reflector of Google Research's [Harness²](https://github.com/google-research/harness2), with approval replacing its candidate probes. Lessons are text only and cannot change tools, accounts, credentials or the write guard.

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

The [crew-agents](../crew-agents/README.md) bundle mounts the service and puts a `./lessons` row with `member: <preset id>` in every crew preset. Rate crew messages with the thumbs buttons, then open **Crew** in the right panel and review **Learning**.

| Field | Default | Meaning |
|---|---|---|
| `homeDirectory` | required; the bundle sets `<dsh home>/crew` | Folder holding `learning.json` |
| `reflectEveryUserMessages` | `6` | Review a crew chat after this many new user messages; `0` reviews only after ratings |
| `debounceSeconds` | `45` | Wait after the last trigger, so a rating and its note arrive together |
| `maxLessonsPerMember` | `12` | Approved lessons a member keeps; approving more asks to remove one first |
| `maxTranscriptChars` | `24000` | Conversation budget sent to the reflector; the oldest lines go first |
| `maxOutputTokens` | `2000` | Reflector output cap |
| `timeoutMs` | `120000` | Reflector deadline |
| `provider`, `model` | the chat's own route | Set both to review with another model |

The `crewImprove` Remote offers `learning()`, `approve(proposalId)`, `reject(proposalId)` and `forget(lessonId)`. A rejected or removed lesson is never proposed again. A proposal may name a lesson it `replaces`; approving it swaps the two.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The service listens to `session/event` globally. A Session belongs to a crew member when the preset registry's `presetForSession` is a `crew-*` id. Ratings are kept from delivered `feedback/message-put` and `feedback/message-delete` events, and a rating or enough user messages schedule a debounced review of that Session; a rating outranks a message count inside one window. A review renders the Session's current model history (the user's messages, the member's answers with the tools they called), each rating with its note and category after the message it rates, then makes one text-only `crew-improve` request on the chat's route. Output is parsed as JSON; proposals without evidence, with empty text, duplicating a current, pending or rejected lesson, or beyond three are dropped, and `replaces` must name a current lesson.

Changes apply to a copy of `learning.json`, are written atomically with mode `0600`, then published, so a failed write changes nothing. The `./lessons` row registers a literal `crew-lessons` system-prompt section at order 9500 in its preset scope; its text is read at each assembly from the approved lessons.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, triggers, reflector call, storage and Remote |
| [`src/reflect.ts`](src/reflect.ts) | Member detection, transcript, reflector prompt, output parsing and the prompt section |
| [`src/lessons.ts`](src/lessons.ts) | Preset row adding the member's lessons |
| [`src/types.ts`](src/types.ts) | Types shared with the browser |
| [`tests/`](tests/) | Triggers, approval, rejection, replacement, failure, the row and parsing |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [message-feedback](../../feedback/message-feedback/README.md) — the ratings that trigger a review.
- [system-prompt](../../core/system-prompt/README.md) — scoped prompt sections.
- [crew-agents-ui](../crew-agents-ui/README.md) — the Learning list.
- [Harness² paper](https://arxiv.org/abs/2610.14224) — recursive agent harnessing.

<a id="model-experience"></a>
## Model Experience

### Lessons section

#### What the model sees

A crew member with approved lessons reads this section in its system prompt, followed by one `- <lesson>` line per lesson:

##### Lessons section text

```markdown
# Lessons from earlier conversations
The user approved these lessons from your earlier conversations with them. Follow them unless the user asks otherwise now. They never relax the rules above about approval.
```

#### Token effect

About 40 tokens plus each lesson, at most twelve lessons of 280 characters; nothing for a member without lessons.

#### KV Cache effect

The section text changes only when the user approves, replaces or removes a lesson; the prompt is otherwise prefix-stable.

### Reflector request

#### What the model sees

A separate request with purpose `crew-improve`: the reflector instruction, then the member's current lessons and the conversation as JSON. It is not part of any conversation's history.

#### Token effect

One request per review, bounded by `maxTranscriptChars` input and `maxOutputTokens` output, billed on the chat's route.

#### KV Cache effect

None on conversations; the request has its own prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only live Sessions are observed; rating a chat that is not loaded does not start a review, and ratings given before dsh started are not shown to the reflector.
- Unlike Harness², candidates are not re-run against each other; the user's approval is the only check.
- Each review is a paid model request; set `reflectEveryUserMessages: 0` to review only after ratings.
- Pending reviews are in memory and are lost when dsh restarts.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests run the real Session store with a fake model that returns fixed proposals.

</details>
