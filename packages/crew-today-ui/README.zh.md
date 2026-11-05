---
description: "Crew 今日的浏览器端：今日页面及其侧边栏入口，包含 crew 状态、摘要、等待你处理的事项、股票卡片、本周日历和未合并的拉取请求。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-today-ui

[English](README.md) | 中文

## 概述

**今日** 是左侧边栏面板列表中的一个页面。它自上而下显示每位 crew 成员的头像和状态、每日摘要、列出所有需要你决定的成员的 **等待你确认**、标普 500 市场卡片、本周日历和你的未合并拉取请求。每个列表都标明来源和获取时间；未连接的账户会显示连接方法，而不是虚构的数据。页面上的任何操作都需要点击才会执行。

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

[crew-today](../crew-today/README.zh.md) bundle 挂载本插件。它需要 crew bundle 提供的 `ctx.crew` 和 `ctx.crewFaces`，以及 [crew-stock-chart-ui](../crew-stock-chart-ui/README.zh.md) 提供的 `ctx.stockChartCards`。

- **Crew**：每位成员一个标签；点击打开该成员的对话。
- **每日摘要**：在 crew-digest 写入之前为空。
- **等待你确认**：Session 正在等待审批或回答的成员，每项都有 **查看**，打开该 Session 由你在那里决定。
- **市场**：来自 Yahoo Finance 的 `^GSPC` 共享股票卡片，支持区间切换和刷新。
- **本周** 和 **未合并的拉取请求**：来自 `crewToday` Remote，失败后可重试。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

页面通过可观察钩子读取名册，并在每次挂载时加载两个账户列表和第一次报价。Remote 回复丢失和 `failed` 结果都会显示失败提示和重试；`not-connected` 显示连接提示。

| 源码 | 内容 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 注册 |
| [`src/client/TodayPage.tsx`](src/client/TodayPage.tsx) | 页面与各区块 |
| [`src/client/locales.ts`](src/client/locales.ts) | 文案 |
| [`tests/`](tests/) | 区块状态与操作 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-today](../crew-today/README.zh.md)——列表背后的 Remote。
- [crew-agents-ui](../crew-agents-ui/README.zh.md)——名册和头像。
- [crew-stock-chart-ui](../crew-stock-chart-ui/README.zh.md)——股票卡片。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器页面，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **等待你确认** 会打开对应 Session 由你决定；可在本页直接执行的发送、合并和编辑卡片尚未实现。
- 安装 crew-digest 之前摘要保持为空。
- 市场卡片只显示一个固定代码 `^GSPC`。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用假的加载函数和占位股票卡片渲染页面，覆盖每个区块的加载、空、未连接和失败状态。

</details>
