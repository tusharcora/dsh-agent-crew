---
description: "Crew 看板 Host 端：以 Session 团队负责人身份在看板列之间移动团队任务的 Remote。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-kanban

[English](README.md) | 中文

## 概述

看板标签页让你手动移动团队任务。本 Host 插件把两列之间的移动转换为对应的那一个团队任务状态变更，并以 Session 团队负责人身份通过团队工具使用的同一比较并设置更新来执行。看板不允许的移动、非负责人 Session 的移动，或自看板绘制后已变化的任务，都会附带原因被拒绝。

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

[crew-agents](../crew-agents/README.zh.md) bundle 将本插件与 [crew-kanban-ui](../crew-kanban-ui/README.zh.md) 一起挂载。`crewKanban` Remote 提供 `move(sessionId, taskId, expectedRevision, from, to)`，返回 `{ ok: true, revision }` 或 `{ ok: false, message }`。

| 从 | 到 | 团队操作 |
|---|---|---|
| 待办 | 进行中 | `claim`：负责人 Session 成为负责人 |
| 进行中 | 待办 | `release` |
| 进行中 | 已完成 | `complete` |
| 已完成 | 待办 | `reopen` |

受阻的卡片要等依赖完成后才能移动。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

列由任务状态和就绪情况推出：待处理且未就绪为受阻，待处理且就绪为待办，`in_progress` 为进行中，`completed` 为已完成。`move` 先按上表检查这对列，再检查调用的 Agent 是其子智能体树的根，然后以看板显示的修订号调用 `ctx.agentTeams.updateTask`。

| 源码 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务与 `move` Remote |
| [`src/moves.ts`](src/moves.ts) | 列与允许的移动 |
| [`src/types.ts`](src/types.ts) | 共享类型 |
| [`tests/`](tests/) | 列、移动与拒绝 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [agent-team](../../team/agent-team/README.zh.md)——任务看板及其状态变更。
- [crew-kanban-ui](../crew-kanban-ui/README.zh.md)——看板标签页。

<a id="model-experience"></a>
## 模型体验

无，本包只为浏览器看板移动团队任务，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 移动以团队负责人身份执行；成员 Session 的看板只读。
- 重新分配给其他成员和编辑任务文本留给团队工具。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用假的 `agentTeams` 和 `subagents` 检查操作、修订号和拒绝情况。

</details>
