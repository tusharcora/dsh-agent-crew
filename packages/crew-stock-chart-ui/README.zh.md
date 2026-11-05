---
description: "股票图表的浏览器端：回答下方的交互式卡片和 ui_stock_chart 工具行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-stock-chart-ui

[English](README.md) | 中文

## 概述

当智能体调用 `ui_stock_chart` 时，本客户端插件在回答下方以卡片显示结果：价格、区间涨跌、1D、5D、1M、6M 和 1Y 按钮、折线或 K 线切换，以及逐根 K 线的十字线读数。区间切换和刷新通过 Host Remote 完成，从不调用模型。请求失败时，卡片保留最后一次成功的数据并说明其获取时间。工具列表中的工具行展开后显示同一张卡片。

## 目录

- [使用本包](#use-this-package)
- [实现原理](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

[crew-stock-chart](../crew-stock-chart/README.zh.md) bundle 挂载此行。卡片：

- 在页脚以链接显示来源并显示获取时间，在图表上方显示最新价时间；
- 页面可见时每隔 `refreshSeconds` 刷新一次；
- 随指针移动十字线，或在聚焦图表后用左右方向键移动；Escape 清除；
- 用 `aria-pressed` 标记所选区间和样式，所有涨跌和错误都同时以文字和颜色表达。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

一个 Conversation Turn 定义收集每次已结束的 `ui_stock_chart` 调用作为展示元数据记录的序列，`conversation.chat.turnTail` 条目为每个序列渲染一张卡片。由于 Session 日志是持久边界，元数据在使用前逐字段校验。以 `ui_stock_chart` 为键的 `tool.call.toolview` 条目渲染工具行。每个请求都有编号，只应用最新请求的结果，因此较慢的刷新不会覆盖更新的区间。

| 源文件 | 内容 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Remote 挂载与注册 |
| [`src/client/StockCard.tsx`](src/client/StockCard.tsx) | 卡片、区间、刷新与失败处理 |
| [`src/client/StockChart.tsx`](src/client/StockChart.tsx) | 带十字线的 SVG 折线与 K 线 |
| [`src/client/chart-scale.ts`](src/client/chart-scale.ts) | 图表几何 |
| [`src/client/stock-turn.ts`](src/client/stock-turn.ts) | 来自 `tool/result` 元数据的 Turn 数据 |
| [`src/client/StockRow.tsx`](src/client/StockRow.tsx) | 工具行 |
| [`src/client/series.ts`](src/client/series.ts) | 元数据校验与格式化 |
| [`tests/`](tests/) | 校验、几何与卡片行为 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-stock-chart](../crew-stock-chart/README.zh.md) — 工具与报价 Remote。
- [ui-tool](../../client/ui-tool/README.zh.md) — 按键分发的工具行插槽。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器端卡片，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- K 线等间距排列，因此夜间和周末的空档不占宽度，时间轴不是线性的。
- 时间按查看者的时区显示，而不是交易所的时区。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

`tests/fixture.ts` 中的测试序列是虚构的，从不在产品中显示。

</details>
