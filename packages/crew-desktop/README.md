---
description: "Crew desktop bundle: a Remote reporting which computer-use provider runs and on which machine, mounted with the right-panel Desktop tab."
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-desktop

English | [中文](README.zh.md)

## Summary

Agents that use the computer act on a screen you cannot otherwise see. This bundle mounts the right-panel **Desktop** tab from [crew-desktop-ui](../crew-desktop-ui/README.md), which shows the latest screenshot an agent took, and a Host Remote that tells the tab which computer-use provider is registered and on which machine, so you can pause the agent or take over.

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

Install the bundle from the Plugins page or with `dsh plugin`. It inserts two rows, `crew-desktop` and `crew-desktop-ui`, and needs no configuration. Agents only reach the computer when a computer-use provider is mounted, such as the optional Computer Use bundle; without one, the tab says so.

The `crewDesktop` Remote offers `where()`, returning `{ provider?, host, platform }`: the registered `ctx.computerUse` provider name while one is mounted, and the Host machine name and operating system.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The service follows `ctx.computerUse` with `ctx.inject`, so it mounts without computer use and starts reporting a provider when one is registered. `where()` reads `providerName` at call time.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service and Remote |
| [`src/types.ts`](src/types.ts) | `DesktopLocation` |
| [`cordis.patch.yml`](cordis.patch.yml) | Bundle rows |
| [`tests/`](tests/) | Provider and host reporting |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [computer-use](../../computer-use/computer-use/README.md) — the provider registry.
- [crew-desktop-ui](../crew-desktop-ui/README.md) — the Desktop tab.

<a id="model-experience"></a>
## Model Experience

None, as the package only reports the provider and host to the browser and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The Remote reports a provider name, not whether that provider has the operating-system permissions it needs.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The host test provides a fake `computerUse` service and checks that the name appears and disappears with it.

</details>
