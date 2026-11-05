---
description: "交接标签页：显示智能体卡片的实时状态，以及 Session 交给每个子智能体的任务列表，并与其他 crew 页面共享。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-handoff-ui

[English](README.md) | 中文

## 概述

Session 委派工作后，工作就离开了视线。本客户端插件在右侧面板添加 **交接** 标签页：Session 本身和它创建的每个子智能体各一张卡片，显示 crew 成员的头像和名称、预设、是在工作、等待你还是空闲，以及当前任务。卡片下方每个智能体一列，按从新到旧列出交给它的每项任务，包括简短的任务标签、简要说明的第一行、交接时间和所用工具。其他 crew 页面通过 `ctx.crewHandoffs` 复用该视图。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载本插件。在任意 Session 中从右侧面板的指南打开 **交接**；点击卡片会打开该智能体的 Session。列中最新的一项在智能体工作或等待你时显示 **在…处**，空闲后显示 **已交回**。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

交接是指展示元数据为 `{ kind: 'activation', name }` 的成功工具结果，每个子智能体委派工具都会返回它；对应的 `tool/call` 提供 `description`、`prompt` 和 `agent_preset` 参数。标签页读取 Session 已加载的事件窗口、用于子智能体的 `subagentCatalog` 投影，以及用于每张卡片预设和状态的 Session 列表与状态。

| 源码 | 内容 |
|---|---|
| [`src/client/handoffs.ts`](src/client/handoffs.ts) | 从事件读取交接 |
| [`src/client/view.ts`](src/client/view.ts) | 卡片与列 |
| [`src/client/HandoffView.tsx`](src/client/HandoffView.tsx) | 视图 |
| [`src/client/HandoffTab.tsx`](src/client/HandoffTab.tsx) | 标签页主体 |
| [`src/client/index.ts`](src/client/index.ts) | 注册与 `ctx.crewHandoffs` |
| [`tests/`](tests/) | 读取、构建与绘制 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [tool-subagent](../../subagent/tool-subagent/README.zh.md)——委派工具。
- [ui-subagent](../../client/ui-subagent/README.zh.md)——Session 标题中的子智能体树。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器视图，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 不显示每个智能体的费用；dsh 记录的是 token 用量而不是价格。
- 只显示 Session 日志中已加载部分的交接。
- 子智能体之间的交接显示在委派方子智能体自己的 Session 中，而不是负责人的 Session 中。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用真实事件结构读取合成事件，并用构建出的模型渲染视图。

</details>
