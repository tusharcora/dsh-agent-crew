---
description: "Browser half of the stock chart: the interactive card beneath answers and the ui_stock_chart tool row."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-stock-chart-ui

English | [中文](README.zh.md)

## Summary

When an agent calls `ui_stock_chart`, this client plugin shows the result as a card beneath the answer: price, change over the range, 1D, 5D, 1M, 6M and 1Y buttons, a line or candles toggle, and a crosshair readout of each bar. Range switching and refresh go through the Host Remote, never the model. If a request fails, the card keeps the last good data and says when it was fetched. The tool's row in the tool list expands to the same card.

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

The [crew-stock-chart](../crew-stock-chart/README.md) bundle mounts this row. The card:

- shows the source as a link and the fetch time in the footer, and the last-price time above the chart;
- refreshes every `refreshSeconds` while the page is visible;
- moves the crosshair with the pointer, or with the left and right arrow keys after focusing the chart; Escape clears it;
- marks the selected range and style with `aria-pressed`, and states every change and error in words as well as colour.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A Conversation Turn definition collects the series each settled `ui_stock_chart` call recorded as presentation metadata, and the `conversation.chat.turnTail` entry renders one card per series. The metadata is validated field by field before use, because the Session log is a durable boundary. The `tool.call.toolview` entry keyed `ui_stock_chart` renders the row. Each request takes a number and only the newest answer is applied, so a slow refresh cannot overwrite a newer range.

| Source | Contents |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Remote mount and registrations |
| [`src/client/StockCard.tsx`](src/client/StockCard.tsx) | Card, ranges, refresh and failure handling |
| [`src/client/StockChart.tsx`](src/client/StockChart.tsx) | SVG line and candles with crosshair |
| [`src/client/chart-scale.ts`](src/client/chart-scale.ts) | Chart geometry |
| [`src/client/stock-turn.ts`](src/client/stock-turn.ts) | Turn data from `tool/result` metadata |
| [`src/client/StockRow.tsx`](src/client/StockRow.tsx) | Tool row |
| [`src/client/series.ts`](src/client/series.ts) | Metadata validation and formatting |
| [`tests/`](tests/) | Validation, geometry and card behavior |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [crew-stock-chart](../crew-stock-chart/README.md) — the tool and the quote Remote.
- [ui-tool](../../client/ui-tool/README.md) — the keyed tool-row slot.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side card that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Bars are spaced evenly, so overnight and weekend gaps take no width and the time axis is not linear.
- Times show in the viewer's time zone, not the exchange's.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The test series in `tests/fixture.ts` is made up and never shown in the product.

</details>
