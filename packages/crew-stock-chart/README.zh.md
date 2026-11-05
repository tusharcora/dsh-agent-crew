---
description: "基于 Yahoo Finance 图表接口的股票图表工具：给模型的带来源和获取时间的报价，以及浏览器卡片在不调用模型的情况下切换区间和刷新所用的 Remote。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-crew-stock-chart

[English](README.md) | 中文

## 概述

智能体可以把股票代码显示为交互式图表。`ui_stock_chart` 工具从 Yahoo Finance 图表接口获取价格，给模型一段带来源和获取时间的报价，并为浏览器卡片记录完整序列。卡片的区间按钮和定时刷新调用本包的 `stockCharts.quote` Remote，因此不会发起模型请求。本 bundle 同时挂载卡片 [crew-stock-chart-ui](../crew-stock-chart-ui/README.zh.md)。

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

在插件页面或通过 `dsh plugin` 安装本 bundle，然后向任意智能体请求图表，例如“显示 AAPL 近六个月的走势”。无需账户或密钥。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `baseUrl` | `https://query1.finance.yahoo.com/v8/finance/chart` | 截至 `/chart` 的图表接口 |
| `timeoutMs` | `10000` | 请求截止时间，至少 1000 |
| `refreshSeconds` | `60` | 已打开卡片自动刷新的间隔秒数，至少 15 |
| `userAgent` | `dsh-crew-stock-chart` | 发送给 Yahoo 的 `User-Agent`，缺少它时 Yahoo 会拒绝请求 |

区间为 `1d`、`5d`、`1mo`、`6mo` 和 `1y`，分别以 5 分钟、15 分钟和日线获取。代码使用 Yahoo 的格式：`AAPL`、`^GSPC`、`BRK-B`、`EURUSD=X`。

`stockCharts.quote(symbol, range)` Remote 返回 `{ ok: true, series }`，或带有 `invalid-symbol`、`not-found`、`unavailable`、`bad-response` 代码的 `{ ok: false, code, message }`。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

该服务是 `stockCharts` 下的 `TypertRemoteService`，全局注册工具。请求前会按 Yahoo 的字符集检查代码。没有收盘价的 K 线会被丢弃，缺失的开盘、最高或最低价回退为收盘价。`1d` 的涨跌参考价为上一交易日收盘价，其他区间为区间开始前的收盘价。每个序列都带有 `source`（Yahoo Finance 及该代码的公开页面）、`fetchedAt` 和 `marketTime`。

工具返回序列；`render` 给模型下文所述的摘要，`presentationMeta` 把完整序列记录在 `tool/result` 事件中，因此卡片可从 Session 日志重放。

| 源文件 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、工具、Remote 与配置 |
| [`src/yahoo.ts`](src/yahoo.ts) | 请求 URL、代码检查与响应解析 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的序列和结果类型 |
| [`tests/`](tests/) | 基于录制响应的解析、失败情况与摘要测试 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-stock-chart-ui](../crew-stock-chart-ui/README.zh.md) — 回答下方的卡片与工具行。
- [Tools](../../core/tools/README.zh.md) — 工具定义与展示元数据。

<a id="model-experience"></a>
## 模型体验

### 股票图表工具

#### 模型看到什么

安装本 bundle 后，[`ui_stock_chart` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-experimental-crew-stock-chart) 出现在每个 Session 中。成功的调用返回一段文字，包含代码与名称、价格与货币、区间涨跌、最新价时间、来源页面和获取时间，并以下面这行结尾。失败的调用返回原因，例如 `"A A" is not a ticker symbol` 或 `No data found, symbol may be delisted`。

##### 结果结尾

```markdown
The user sees an interactive chart with range buttons below this call; do not repeat the price series.
```

#### Token 影响

声明在每个请求中约 120 个 token。每次调用增加约 90 个 token 的结果；价格序列不进入模型历史。

#### KV Cache 影响

安装期间声明固定，因此保持请求前缀稳定。卡片中的区间切换和刷新不会向模型历史添加任何内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- Yahoo Finance 图表接口是非官方接口，没有公开的条款或频率限制；Yahoo 可能更改或屏蔽它。
- 工具对每个 Session 注册，而不仅限于 crew 预设。
- 日内区间使用交易所发布的 K 线，价格可能按 Yahoo 对该交易所的延迟滞后于市场。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

`tests/fixtures/aapl-5d.json` 是裁剪后的真实响应；其中删去了一个收盘价以模拟缺口。

</details>
