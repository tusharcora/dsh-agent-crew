---
description: "Crew 工作流：保存的智能体工作流和固定工作流、按阶段在 crew 成员之间传递工作的运行器，以及供智能体使用的草稿工具。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-workflows

[English](README.md) | 中文

## 概述

工作流是保存在磁盘上的一组步骤。智能体工作流在 crew 成员之间传递工作；固定工作流只运行工具调用。步骤按阶段依次运行，标记为 `together` 的步骤与上一步同时运行。每次运行都有一个负责人 Session，crew 成员在它之下工作，每个阶段的结果会交给下一阶段。`crewWorkflows` Remote 为 [crew-workflows-ui](../crew-workflows-ui/README.zh.md) 保存、运行和取消工作流。`crew_workflow_draft` 工具让智能体提出草稿，草稿在用户点击“运行”之前不会运行。

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

[crew-agents](../crew-agents/README.zh.md) Bundle 以 `~/.dsh/crew` 为目录挂载本包。在侧边栏“自动化”下方打开 **工作流**，或让 crew 成员“设置一个……的工作流”。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `homeDirectory` | 必填 | 存放 `workflows.json` 和默认工作文件夹 `workflows/` 的目录 |
| `provider` | `spawn` | 运行 crew 成员步骤的 subagent 提供方 |
| `keepRuns` | `30` | 文件中保留的已结束运行数 |

| Remote | 返回 |
|---|---|
| `state()` | `{ ok: true, value: { workflows, runs } }` |
| `save(definition)` | 带 id 的已保存定义，或阻止保存的问题 |
| `deleteWorkflow(id)` | 成功；过往运行仍会列出 |
| `run(id)` | 新运行的 id；拒绝草稿和无效定义 |
| `cancel(runId)` | 成功，或该运行未在运行 |

工具步骤以负责人 Session 的身份经过常规工具流水线运行，因此审批提示和守卫与其他调用一样适用。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`CrewWorkflows` 是位于 `crewWorkflows` 下的 `TypertRemoteService`。`problemsOf` 检查定义：名称、1–24 个步骤、唯一 id、crew 成员步骤使用 crew preset（`crew-*`）、工具步骤使用已有工具名，以及固定工作流中没有 crew 成员步骤。`stagesOf` 把步骤分组为阶段。

`runWorkflow` 创建负责人 Session（智能体工作流使用 preset `crew-chief`，标题为“Workflow: 名称”），然后用 `Promise.all` 运行每个阶段。crew 成员步骤通过 `ctx.subagents.startActivation` 启动并把结果交给调用方；其提示末尾附有“Results from earlier steps”一节，上限 12,000 个字符。某一步失败会把运行标记为失败、后续步骤标记为跳过；取消会中止所有正在运行的步骤。输出最多保留 4,000 个字符。每次变更都以 0600 权限原子写入 `workflows.json`；dsh 启动时仍标记为运行中的运行会被标记为已取消。

| 源码 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、Remote、存储和草稿工具 |
| [`src/runner.ts`](src/runner.ts) | 阶段、交接提示、失败与取消 |
| [`src/validate.ts`](src/validate.ts) | 定义检查和阶段 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的类型 |
| [`tests/`](tests/) | 基于伪造 Host 操作的检查、阶段、提示和运行测试 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-workflows-ui](../crew-workflows-ui/README.zh.md) — 工作流页面。
- [Subagent](../../subagent/subagent/README.zh.md) — crew 成员步骤如何启动。
- [Tools](../../core/tools/README.zh.md) — 工具步骤经过的流水线。

<a id="model-experience"></a>
## 模型体验

### 工作流草稿工具

#### 模型看到的内容

安装 Bundle 后，[`crew_workflow_draft` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-crew-workflows)出现在每个 Session 中。调用会保存草稿并返回一行：要么草稿已保存、请用户审阅并运行，要么给出草稿 id 和用户必须先修复的问题。

##### 结果

```markdown
Saved draft wf-1a2b3c4d. Tell the user to review it on the Workflows page and click Run when it looks right.
```

#### Token 影响

声明在每次请求中约 200 个 token；每次调用增加约 40 个 token 的结果。crew 成员步骤在各自的 Session 中运行，不会增加调用方的历史。

#### KV Cache 影响

安装 Bundle 后声明保持不变，因此请求前缀保持稳定。运行和页面操作不会增加调用方的模型历史。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 运行存在于 dsh 进程中；退出 dsh 会取消它们，已取消的运行无法继续。
- 草稿工具为每个 Session 注册，而不只是 crew preset。
- 阶段之间传递的结果只有文本，截断为 12,000 个字符。
- 没有定时触发；可用“自动化”启动一个请求运行的 Session。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

运行器以 `RunnerDeps` 接收 Host 操作，因此测试无需 dsh 即可驱动它。`problemsOf` 的消息保持简明英文；编辑器原样显示。

</details>
