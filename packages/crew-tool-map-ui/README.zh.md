---
description: "工具标签页：每个智能体的工具权限、调用次数和上次调用用时，并可只读查看每次调用，与其他 crew 页面共享。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-tool-map-ui

[English](README.md) | 中文

## 概述

每个智能体能用哪些工具、用它们做了什么？本客户端插件在右侧面板添加 **工具** 标签页。选择 Session 或它的某个子智能体：智能体位于其工具中间，每个工具标注调用次数和上次调用用时、**尚未使用**，或在视图中另一个智能体拥有而它没有时标注 **无权限**。打开某个工具可查看它的每次调用，输入和输出并排显示。其他 crew 页面通过 `ctx.crewToolMaps` 复用该地图。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载本插件。在任意 Session 中从右侧面板的指南打开 **工具**。查看器是只读的：只显示调用，从不重新执行。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

当智能体最新的 `request/header` 提供了某个工具时，该工具为可用；智能体调用过后为已使用，包括在 `run_code` 程序中发起的调用。**无权限** 比较所选子智能体与本 Session。子智能体的历史只在被选中时通过 `ctx.sessions.retain(id, { source: 'crewToolMap' })` 加载，切换选择时释放。

| 源码 | 内容 |
|---|---|
| [`src/client/tools.ts`](src/client/tools.ts) | 折叠事件并构建单个智能体的地图 |
| [`src/client/ToolMapView.tsx`](src/client/ToolMapView.tsx) | 地图与调用查看器 |
| [`src/client/ToolMapTab.tsx`](src/client/ToolMapTab.tsx) | 标签页主体与子智能体加载 |
| [`src/client/index.ts`](src/client/index.ts) | 注册与 `ctx.crewToolMaps` |
| [`tests/`](tests/) | 折叠、权限与视图 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-handoff-ui](../crew-handoff-ui/README.zh.md)——哪些智能体接收了哪些任务。
- [ui-trajectory](../../client/ui-trajectory/README.zh.md)——完整的时间检查器。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器视图，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- **无权限** 只与本 Session 和所选子智能体比较，而不是整棵树中的所有智能体。
- 没有重放或编辑输入；不能从地图重新执行调用。
- 只显示每个 Session 日志中已加载部分的调用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用真实事件结构折叠合成的请求头和工具调用，并渲染地图和查看器。

</details>
