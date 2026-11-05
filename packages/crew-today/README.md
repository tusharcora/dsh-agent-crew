---
description: "Crew today bundle: a read-only Remote for this week's Google Calendar events and the user's open GitHub pull requests, mounted with the Today page."
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-today

English | [中文](README.zh.md)

## Summary

A Today page gathers what the crew and your accounts know about the day. This bundle mounts the page from [crew-today-ui](../crew-today-ui/README.md) and a read-only Host Remote that reads this week's events from your primary Google calendar and the open GitHub pull requests that involve you, each with its source and fetch time. It sends, merges and books nothing.

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

Install the bundle from the Plugins page or with `dsh plugin`. It inserts two rows, `crew-today` and `crew-today-ui`, and needs no configuration. It reads the credentials [crew-connections](../crew-connections/README.md) stores: the Google access token for the calendar and `CREW_GITHUB_TOKEN` for pull requests. Without one, its list reports `not-connected` and the page asks you to connect the account.

The `crewToday` Remote offers `calendar()` and `pullRequests()`. Each returns `{ ok: true, items, source: { name, url, fetchedAt } }` or `{ ok: false, reason: 'not-connected' | 'failed', message }`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`calendar()` asks the Google Calendar API for single events on the `primary` calendar from Monday 00:00 to the next Monday in the Host's time zone, ordered by start, and drops cancelled ones. `pullRequests()` searches GitHub for `is:pr is:open involves:@me archived:false`, newest update first, up to 20.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service and Remote |
| [`src/fetch.ts`](src/fetch.ts) | Google Calendar and GitHub reads |
| [`src/types.ts`](src/types.ts) | Shared result types |
| [`cordis.patch.yml`](cordis.patch.yml) | Bundle rows |
| [`tests/`](tests/) | Parsing, not-connected and failure paths |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-connections](../crew-connections/README.md) — where the Google sign-in and GitHub token are stored.
- [crew-today-ui](../crew-today-ui/README.md) — the Today page.

<a id="model-experience"></a>
## Model Experience

None, as the package only answers the browser's Remote calls and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only the primary calendar is read.
- Pull requests come from GitHub only; other forges are not listed.
- Results are fetched on each page load and not cached.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Tests stub `fetch` with recorded response shapes; no test calls Google or GitHub.

</details>
