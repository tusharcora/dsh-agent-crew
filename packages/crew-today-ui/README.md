---
description: "Browser half of crew today: the Today page and its sidebar entry, with crew status, digest, what waits for you, a stock card, this week's calendar and open pull requests."
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-today-ui

English | [中文](README.zh.md)

## Summary

**Today** is a page in the left sidebar's panel list. From top to bottom it shows each crew member's face and status, the daily digest, **Waiting for your OK** with every member that needs your decision, a market card for the S&P 500, this week's calendar and your open pull requests. Every list names its source and fetch time; an account that is not connected shows how to connect it instead of invented data. Nothing on the page acts without a click.

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

The [crew-today](../crew-today/README.md) bundle mounts this plugin. It needs `ctx.crew` and `ctx.crewFaces` from the crew bundle and `ctx.stockChartCards` from [crew-stock-chart-ui](../crew-stock-chart-ui/README.md).

- **Crew**: one chip per member; a click opens that member's chat.
- **Daily digest**: empty until crew-digest writes one.
- **Waiting for your OK**: members whose Session waits for an approval or answer, each with **Review**, which opens that Session so you decide there.
- **Market**: the shared stock card for `^GSPC` from Yahoo Finance, with its ranges and refresh.
- **This week** and **Open pull requests**: from the `crewToday` Remote, with Retry after a failure.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The page reads the roster through its observable hook and loads the two account lists and the first quote once per mount. A lost Remote reply and a `failed` result both show the failure notice with Retry; `not-connected` shows the connect hint.

| Source | Contents |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Registrations |
| [`src/client/TodayPage.tsx`](src/client/TodayPage.tsx) | Page and sections |
| [`src/client/locales.ts`](src/client/locales.ts) | Copy |
| [`tests/`](tests/) | Section states and actions |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-today](../crew-today/README.md) — the Remote behind the lists.
- [crew-agents-ui](../crew-agents-ui/README.md) — the roster and faces.
- [crew-stock-chart-ui](../crew-stock-chart-ui/README.md) — the stock card.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser page that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Waiting for your OK** opens the Session to decide; Send, Merge and Edit cards that act from this page are not built yet.
- The digest stays empty until crew-digest is installed.
- The market card shows one fixed ticker, `^GSPC`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests render the page with fake loaders and a stub stock card, covering each section's loading, empty, not-connected and failure states.

</details>
