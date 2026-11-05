---
description: "Browser half of crew desktop: the right-panel Desktop tab with the latest tool-result screenshot, where computer use runs, and Pause, Take over and Resume."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-desktop-ui

English | [中文](README.zh.md)

## Summary

This client plugin adds a **Desktop** tab to the right panel. It shows the newest screenshot any tool returned in the Session, labelled with the tool and time, where computer use runs, and whether the agent is working. **Pause** stops the current turn; **Take over** stops it and shows that you are in control until you resume or send a message. The screen updates after each agent action and is not a live stream.

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

The [crew-desktop](../crew-desktop/README.md) bundle mounts this row. Open **Desktop** from the right panel's guide in any Session.

| Control | Effect |
|---|---|
| **Pause** | Stops the agent's current turn through the Session's cancel; enabled while the agent works |
| **Take over** | Stops a running turn, then shows **You're in control** |
| **Resume** | Clears the in-control notice; the agent continues when you send it a message |

A new turn, for example after you send a message, also ends the in-control notice. If stopping fails, the tab says so and the agent stays in control.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The tab reads the Session's loaded event window. The frame is the last `image` block of the newest `tool/result`, named after the matching `tool/call`; offloaded images are skipped. Its bytes come from the Session's `readAttachment` and are shown as a data URL. The model keeps one Desktop state per Session binding, follows its sources only while the tab is open, and reads the location from `crewDesktop.where()` once.

| Source | Contents |
|---|---|
| [`src/client/frame.ts`](src/client/frame.ts) | Frame selection and image encoding |
| [`src/client/desktop-model.ts`](src/client/desktop-model.ts) | Per-Session state, Pause, Take over and Resume |
| [`src/client/DesktopTab.tsx`](src/client/DesktopTab.tsx) | Tab body |
| [`src/client/index.ts`](src/client/index.ts) | Tab type, Remote and slot registration |
| [`src/client/locales.ts`](src/client/locales.ts) | Copy |
| [`tests/`](tests/) | Frame selection, states, labels and stopping |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-desktop](../crew-desktop/README.md) — the bundle and its Remote.
- [ui-sidebar-right](../../client/ui-sidebar-right/README.md) — right-panel tabs.
- [session-controller](../../api/session-controller/README.md) — cancel and attachments.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser tab that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Frames come only from images tools return, so the tab shows nothing until an agent takes a screenshot; a continuous stream (for example over VNC) is deferred.
- Only the loaded part of the Session is searched; an older screenshot beyond it is not shown.
- Take over does not lock the computer; it stops the agent and marks that you are in control.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests drive the tab with a hand-built event window and Session.

</details>
