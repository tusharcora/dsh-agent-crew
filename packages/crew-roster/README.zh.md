---
description: "Crew 成员名册：存储在磁盘上并注册为智能体预设的 crew 成员，并提供添加、编辑和移除成员的 Remote。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-roster

[English](README.md) | 中文

## 概述

在 `members.json` 中保存 crew，并为每位成员注册一个由其名称、职责、说明、头像、能力和连接生成的智能体预设。文件初始包含幕僚长和六位专家。每位成员都能用 `ask_crew` 把工作交给任何队友、加载已安装的技能，并用 `crew_member_create` 添加队友，新队友的能力限于 crew 已有的能力。[crew-agents-ui](../crew-agents-ui/README.zh.md) 通过 `crewRoster` Remote 编辑成员。

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

每位成员还获得 `ask_crew`：一个 [`subagent` 声明](../../subagent/tool-subagent/README.zh.md)，其 `agent_preset` 列出该成员的队友，另有子智能体控制工具；从你发起的对话算起，委派最多两层。`crew_member_create` 为智能体添加成员：没有任何成员具备的能力和连接会被省略并在结果中列出，Crew 标签页会显示是谁添加的，`first_task` 会立即以调用对话的子智能体身份启动它。新版本随附的成员只会加入已有 crew 一次；你移除的成员不会被加回。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`CrewRosterService` 是位于 `crewRoster` 下的 `TypertRemoteService`。`presetFor(member, crew)` 生成预设行：它在说明末尾为每位队友追加一行，并以 `ask_crew` 挂载 `dsh-tool-subagent`，使用 `provider: spawn`、设为队友的 `allowedAgentPresets` 和 `maxDepth: 2`。`capAbilities` 把新建成员限制在 crew 已有的能力和已批准的连接之内。每次变更以 0600 权限原子写入 `members.json`，然后注销并重新注册每位成员的预设，因为每个预设都列出了队友。文件记录已提供过的随附成员 id，因此 `migrate` 只会添加一次新随附的成员，并替换用户从未编辑过的随附说明。智能体预设注册表让已有 Agent 保持其启动时的组合。无法读取的文件保持原样，在修复前运行随附的 crew。

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

运行某位成员预设的 Session 会在系统提示开头看到该成员的说明（`{{model}}` 已解析），以及其能力和连接增加的工具，通过 `run_code` 调用。说明末尾为每位队友列出一行，例如：

##### 队友行

```markdown
Your teammates. Hand one a self-contained task with ask_crew, passing its id as agent_preset:
- crew-mail (Mail): Reads and triages email and drafts replies for your approval.
```

#### Token 影响

说明的开销取决于用户所写内容，通常为 60 到 160 个词，另加每行队友约 20 个 token 和一个 `ask_crew` 声明。

#### KV Cache 影响

在 crew 变化之前前缀保持稳定：任何变更都会改变每位成员新对话的队友行和 `ask_crew` 列表。正在运行的对话保持其启动时的预设。

### 创建工具

#### 模型看到的内容

安装 bundle 后，[`crew_member_create` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-crew-roster)出现在每个 Session 中。调用返回一段文字：新成员的 id、未授予的内容，以及如何向它提问或它对首个任务的回答。

##### 结果

```markdown
Added Designer as crew-designer. Not granted, because no member has it: slack. Ask it with ask_crew and agent_preset crew-designer in a new chat.
```

#### Token 影响

声明在每次请求中约 250 个 token。每次调用增加约 40 个 token，提供首个任务时另加其回答。

#### KV Cache 影响

安装 bundle 后声明保持不变。新建成员会改变 crew，并从下一个新对话起改变每位成员的前缀。

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
