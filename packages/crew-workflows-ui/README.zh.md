---
description: "位于自动化下方的工作流页面：用表单构建智能体工作流和固定工作流，运行它们，并按步骤状态和交接跟进每次运行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-workflows-ui

[English](README.md) | 中文

## 概述

在侧边栏“自动化”正下方添加 **工作流**。页面列出已保存的工作流和智能体提出的草稿。编辑器可构建两种工作流：带成员、任务和说明的 crew 成员步骤，以及带工具名和 JSON 输入的工具步骤。步骤可以上移、下移，或与上一步同时运行。只有已保存且未改动的工作流才能运行。每次运行按“等待中”“运行中”“已完成”“失败”“已跳过”列显示步骤和输出。智能体运行内嵌 [crew-handoff-ui](../crew-handoff-ui/README.zh.md) 的共享交接视图。

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

安装 [crew-agents](../crew-agents/README.zh.md) Bundle；它会与 [crew-workflows](../crew-workflows/README.zh.md) 一起挂载本包。点击 **新建智能体工作流** 或 **新建固定工作流**，添加步骤，然后 **保存** 并 **运行**。**打开负责人 Session** 以对话形式显示运行。删除前会再确认一次。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

插件挂载 `crew-workflows/remote` Remote，然后注册 `main` 页面和 order 为 11 的 `sidebar.panellist` 条目（自动化为 10）。有运行进行时页面每 2 秒重新读取 `state()`，否则每 15 秒一次。crew 成员名称来自 `ctx.crew`；交接视图及其辅助函数来自 `ctx.crewHandoffs`。`handoffData` 把一次运行转换为交接卡片：负责人，以及每个已启动的 crew 成员步骤各一张。

| 源码 | 内容 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Remote 挂载、页面和侧边栏条目 |
| [`src/client/WorkflowsPage.tsx`](src/client/WorkflowsPage.tsx) | 列表、编辑器和运行 |
| [`src/client/Editor.tsx`](src/client/Editor.tsx) | 工作流表单 |
| [`src/client/RunView.tsx`](src/client/RunView.tsx) | 步骤列和交接 |
| [`tests/`](tests/) | 编辑器、运行视图和交接数据 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-workflows](../crew-workflows/README.zh.md) — 存储、运行器和草稿工具。
- [crew-handoff-ui](../crew-handoff-ui/README.zh.md) — 共享交接视图。

<a id="model-experience"></a>
## 模型体验

无，因为本包通过 Remote 编辑和跟进工作流，不增加模型输入或 Session 事件。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 工具步骤接收原始 JSON 输入；没有按工具 schema 生成的表单。
- 步骤通过按钮调整顺序，不支持拖放。
- 页面轮询而不是订阅变更。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

文案位于 `src/client/locales.ts` 的 `crewWorkflows` 命名空间。

</details>
