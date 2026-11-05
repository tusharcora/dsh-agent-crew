---
description: "Crew 成员名册：存储在磁盘上并注册为智能体预设的 crew 成员，并提供添加、编辑和移除成员的 Remote。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-roster

[English](README.md) | 中文

## 概述

在 `members.json` 中保存 crew，并为每位成员注册一个智能体预设。成员记录包含名称、一句话职责、说明、头像、能力（文件、命令、网页、定时任务）和连接，预设由记录生成。首次运行时，文件以幕僚长和五位专家初始化。负责人的 `ask_*` 委派工具和名册行随每次变更更新。[crew-agents-ui](../crew-agents-ui/README.zh.md) 通过 `crewRoster` Remote 编辑成员。

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

[crew-agents](../crew-agents/README.zh.md) bundle 以 `~/.dsh/crew` 为目录挂载本包。在 **Crew** 标签页中编辑成员。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `homeDirectory` | 必填 | 存放 `members.json` 的目录 |

| Remote | 返回 |
|---|---|
| `state()` | `{ members, connections }`：成员记录与成员可连接的服务 |
| `saveMember(member)` | 已保存的记录，或阻止保存的问题。空 ID 表示添加成员，其 ID 为 `crew-` 加名称中的字母 |
| `deleteMember(id)` | 成功；负责人不能被移除 |

每位成员都有时间上下文、`run_code`、crew 写入守卫、已批准的经验、提问和待办列表。能力会增加文件工具（只读或完整）、带后台任务和仓库说明的 shell、网页获取或定时任务工具。连接会增加通过 `${credential:…}` 读取密钥的 MCP 行；账号尚未批准的连接（Slack、Exa、Obsidian）保留其行但保持关闭。一个 crew 最多 16 位成员。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`CrewRosterService` 是位于 `crewRoster` 下的 `TypertRemoteService`。`presetFor(member, crew)` 生成预设行；对负责人，它在说明末尾为其他每位成员追加一行名册，并为其他每位成员挂载一个 `dsh-tool-subagent`，使用 `provider: spawn`、`toolName: ask_<字母>` 和该成员的预设。每次变更以 0600 权限原子写入 `members.json`，然后注销并重新注册受影响的预设和负责人的预设。智能体预设注册表让已有 Agent 保持其启动时的组合。无法读取的文件保持原样，在修复前运行随附的 crew。

| 源码 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、存储与 Remote |
| [`src/compose.ts`](src/compose.ts) | 记录检查、ID 与预设行 |
| [`src/defaults.ts`](src/defaults.ts) | 随附成员与连接目录 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的类型 |
| [`tests/`](tests/) | 检查、预设行，以及基于伪注册表的添加、编辑和移除 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-agents-ui](../crew-agents-ui/README.zh.md) — Crew 标签页编辑器。
- [agent-preset-registry](../../preset/agent-preset-registry/README.zh.md) — 预设如何注册。
- [crew-agents](../crew-agents/README.zh.md) — bundle。

<a id="model-experience"></a>
## 模型体验

### 成员预设

#### 模型看到的内容

运行某位成员预设的 Session 会在系统提示开头看到该成员的说明（`{{model}}` 已解析），以及其能力和连接增加的工具，通过 `run_code` 调用。负责人的说明末尾为其他每位成员列出一行，例如：

##### 负责人名册行

```markdown
Your crew, and the tool that asks each one:
- ask_mail: Mail. Reads and triages email and drafts replies for your approval.
```

#### Token 影响

说明的开销取决于用户所写内容，通常为 60 到 160 个词。负责人每行名册约增加 20 个 token，并为每位成员增加一个委派声明。

#### KV Cache 影响

在编辑成员之前前缀保持稳定：变更会改变该成员新对话以及负责人新对话的系统提示和工具。正在运行的对话保持其启动时的预设。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 移除成员后其过往对话会保留，但 dsh 重启后无法开始新的轮次。
- 无法为成员选择模型；成员使用其 Session 的模型。
- 连接仅限 `src/defaults.ts` 中的目录。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

`presetFor` 接收平台参数，以便测试为任一平台组合 bash 与 PowerShell 行；crew-agents 中的 bundle 测试会根据各包的配置 schema 校验随附的预设。

</details>
