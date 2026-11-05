---
description: "Stock chart tool over the Yahoo Finance chart endpoint: a model-facing quote with source and fetch time, and a Remote the browser card uses to switch ranges and refresh without the model."
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-stock-chart

English | [中文](README.zh.md)

## Summary

Agents can show a ticker as an interactive chart. The `ui_stock_chart` tool fetches prices from the Yahoo Finance chart endpoint, gives the model a one-paragraph quote with its source and fetch time, and records the full series for the browser card. The card's range buttons and timed refresh call this package's `stockCharts.quote` Remote, so they never start a model request. The bundle also mounts the card, [crew-stock-chart-ui](../crew-stock-chart-ui/README.md).

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

Install the bundle from the Plugins page or with `dsh plugin`, then ask any agent for a chart, for example “show me AAPL over six months”. No account or key is needed.

| Field | Default | Meaning |
|---|---|---|
| `baseUrl` | `https://query1.finance.yahoo.com/v8/finance/chart` | Chart endpoint up to `/chart` |
| `timeoutMs` | `10000` | Request deadline, at least 1000 |
| `refreshSeconds` | `60` | Seconds between automatic refreshes of an open card, at least 15 |
| `userAgent` | `dsh-crew-stock-chart` | `User-Agent` sent to Yahoo, which refuses requests without one |

Ranges are `1d`, `5d`, `1mo`, `6mo` and `1y`, fetched as 5-minute, 15-minute and daily bars respectively. Symbols use Yahoo's forms: `AAPL`, `^GSPC`, `BRK-B`, `EURUSD=X`.

The `stockCharts.quote(symbol, range)` Remote returns `{ ok: true, series }` or `{ ok: false, code, message }` with code `invalid-symbol`, `not-found`, `unavailable` or `bad-response`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The service is a `TypertRemoteService` under `stockCharts` that registers the tool globally. Symbols are checked against Yahoo's character set before any request. Bars without a close are dropped, and missing open, high or low values fall back to the close. The change reference is the previous session's close for `1d` and the close before the range starts otherwise. Every series carries `source` (Yahoo Finance and the symbol's public page), `fetchedAt` and `marketTime`.

The tool returns the series; `render` gives the model the summary below, and `presentationMeta` records the whole series in the `tool/result` event, so the card replays from the Session log.

| Source | Contents |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, tool, Remote and config |
| [`src/yahoo.ts`](src/yahoo.ts) | Request URLs, symbol check and response parsing |
| [`src/types.ts`](src/types.ts) | Series and result types shared with the browser |
| [`tests/`](tests/) | Parsing against a recorded response, failures and the summary |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-stock-chart-ui](../crew-stock-chart-ui/README.md) — the card beneath answers and the tool row.
- [Tools](../../core/tools/README.md) — tool definitions and presentation metadata.

<a id="model-experience"></a>
## Model Experience

### Stock chart tool

#### What the model sees

The [`ui_stock_chart` declaration](../../../docs/tool-catalog.md#deepseek-aidsh-crew-stock-chart) appears in every Session while the bundle is installed. A successful call returns one paragraph with the symbol and name, price and currency, change over the range, the last-price time, the source page and the fetch time, ending with the line below. A failed call returns its reason, such as `"A A" is not a ticker symbol` or `No data found, symbol may be delisted`.

##### Result ending

```markdown
The user sees an interactive chart with range buttons below this call; do not repeat the price series.
```

#### Token effect

The declaration is about 120 tokens on every request. Each call adds about 90 tokens of result; the price series stays out of model history.

#### KV Cache effect

The declaration is fixed while the bundle is installed, so it keeps the request prefix stable. Range switching and refresh in the card add nothing to model history.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The Yahoo Finance chart endpoint is unofficial and has no published terms or rate limits; Yahoo can change or block it.
- The tool is registered for every Session, not only crew presets.
- Intraday ranges use the exchange's bars as published, so prices can lag the market by the delay Yahoo applies to that exchange.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

`tests/fixtures/aapl-5d.json` is a trimmed real response; one close is removed to model a gap.

</details>
