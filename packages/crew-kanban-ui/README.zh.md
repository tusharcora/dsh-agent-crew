---
description: "Session 团队任务的看板标签页：四列卡片可拖动或在详情面板中移动，并与其他 crew 页面共享。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-kanban-ui

[English](README.md) | 中文

## 概述

团队任务以列显示更容易跟进。本客户端插件在右侧面板添加 **看板** 标签页，按受阻、待办、进行中和已完成显示当前 Session 的团队任务，每张卡片显示编号、标题、负责人、依赖和写入范围。把卡片拖到另一列，或打开卡片选择 **移到**；移动通过 [crew-kanban](../crew-kanban/README.zh.md) 执行，状态行会说明是否成功。其他 crew 页面通过 `ctx.crewBoards` 复用看板。

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

在开启 **使用智能体团队** 的 Session 中，从右侧面板的指南打开 **看板**；未开启时标签页会说明如何开启。受阻的卡片不能移动，拖动时可移入的列会高亮。`ctx.crewBoards` 提供 `Board` 和 `moveFor(sessionId)`。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

标签页读取 Session 的 `agentTeam` 投影，因此成员修改任务时看板会更新。卡片使用 HTML 拖放 API，携带编号和所在列；拖到规则不允许的列会被忽略。详情面板以按钮提供同样的移动，供键盘和读屏用户使用。浏览器保留一份列规则副本，由测试与 Host 版本保持一致，Host 仍会校验每次移动。

| 源码 | 内容 |
|---|---|
| [`src/client/KanbanBoard.tsx`](src/client/KanbanBoard.tsx) | 看板、卡片与详情面板 |
| [`src/client/BoardTab.tsx`](src/client/BoardTab.tsx) | 标签页主体 |
| [`src/client/moves.ts`](src/client/moves.ts) | 列规则的浏览器副本 |
| [`src/client/index.ts`](src/client/index.ts) | 注册与 `ctx.crewBoards` |
| [`tests/`](tests/) | 看板状态、移动与规则一致性 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-kanban](../crew-kanban/README.zh.md)——移动 Remote。
- [ui-agent-team](../../client/ui-agent-team/README.zh.md)——Session 标题中的精简任务列表。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器看板，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 只有团队负责人 Session 的看板可以移动卡片。
- 没有撤销；在规则允许时把卡片移回即可。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用投影样例渲染看板，并通过详情面板和拖放驱动移动。

</details>
