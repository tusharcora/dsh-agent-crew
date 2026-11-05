---
description: "Browser roster of the crew agents: each member's localized name, live status and a Session start, shared with other crew plugins."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-agents-ui

English | [中文](README.zh.md)

## Summary

This client plugin provides `ctx.crew`: the six crew members with their designed faces, localized names and live status (working, needs you or idle), folded from the Session list and the Session status the browser already tracks, plus a way to start a Session with a member. It draws a **Crew** section above the workspaces listing every member, each with its own chat, a badge in the chat header of crew Sessions, and a **Crew** tab in the right panel. It adds no Host service.

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

The [crew-agents](../crew-agents/README.md) bundle mounts this row. A browser plugin injects `crew` and reads:

| Member | Meaning |
|---|---|
| `members` | Observable roster: `{ id, status, sessions, open, home, focus }` per member, in roster order |
| `name(id)` | Localized member name |
| `statusLabel(state)` | Localized `Working`, `Needs you` or `Idle` |
| `openChat(id)` | Open the member's focus Session, creating its own chat outside any workspace when it has none |
| `startInWorkspace(id, workspaceId)` | Start a new chat with the member in a workspace |

Draw a member with `ctx.crewFaces.Face` from [crew-faces](../crew-faces/README.md), passing the member id as `agentId`, its entry in the exported `CREW_FACE_DESIGNS` as `design`, and `mood="working"` while its status is `working`.

### Faces

| Member | Body | Colour |
|---|---|---|
| Chief of staff | orb | `#0B0B0C`, with white eyes |
| Mail | block | `#E8B4A0` |
| Chat | bean | `#C9B6E4` |
| Code | drop | `#4D6BFE` |
| Research | orb | `#A8C7A1` |
| Life | bean | `#F2D16B` |

A member's eyes move up and right while it works.

### Crew section and chat header

The section uses the `sidebar.sections` slot and lists every member, idle ones included, with a status chip while it works or needs you. Each member has its own chat: a Session outside any workspace, running in the member's folder that [crew-connections](../crew-connections/README.md) provides, and created the first time it is opened. A row opens the Session waiting on you, else one running, else the member's own chat. The **⋯** menu opens the own chat or starts a new chat with the member in any workspace. The collapsed rail shows the faces alone, each still named for assistive technology and in its tooltip.

The badge uses `conversation.session.header.actions` and appears only in Sessions that run a crew preset.

### Connections

Below the roster, the Crew tab lists the crew's MCP connections, who uses each and its state in words. Google takes an OAuth client id and secret, then **Sign in with Google** opens Google's consent page; GitHub takes a token. Secrets go to the Host credential store and are never shown back: a stored one reads as stored and can be replaced or removed. Keyless servers read **No account needed**, and servers waiting for your approval read **Off until you approve it**.

### Crew tab

Open **Crew** from the right panel's guide in any Session. Each row shows the member's face, name, status in words (Working, Needs you or Idle), its Session count and a **New session** button that starts a Session with that member's preset. The tab only reads status; it changes nothing on its own.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A Session belongs to a member when its listed `agentPreset` projection value equals the member's preset id. A member is `needs-you` while any of its Sessions has a pending interaction, such as an unanswered question or approval, else `working` while any runs, else `idle`. Live running state from `uiSession.sessionStatus` takes precedence over the list's running flag. The roster snapshot keeps its identity until a member's status or Session list changes, so React selectors re-render only on real changes.

| Source | Contents |
|---|---|
| [`src/roster.ts`](src/roster.ts) | Member ids and the status fold |
| [`src/client/index.ts`](src/client/index.ts) | Registrations |
| [`src/client/crew-roster.ts`](src/client/crew-roster.ts) | `ctx.crew` service and chat opening |
| [`src/client/CrewPanel.tsx`](src/client/CrewPanel.tsx) | Crew tab |
| [`src/client/CrewSection.tsx`](src/client/CrewSection.tsx) | Sidebar section |
| [`src/client/CrewHeader.tsx`](src/client/CrewHeader.tsx) | Chat header badge |
| [`src/faces.ts`](src/faces.ts) | Designed faces |
| [`src/client/locales.ts`](src/client/locales.ts) | Names, status labels and tab copy |
| [`tests/`](tests/) | Fold and service tests |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-agents](../crew-agents/README.md) — the presets the roster follows.
- [crew-faces](../crew-faces/README.md) — member faces.
- [ui-session](../../client/ui-session/README.md) — the Session status source.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side roster that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only Sessions in the browser's Session list count; a delegated child the list does not retain does not change its member's status.
- Member ids are fixed to the presets crew-agents declares; a renamed preset id is not followed.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
