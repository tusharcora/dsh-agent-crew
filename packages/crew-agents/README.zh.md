---
description: "Crew：整个 crew 的唯一插件。一位幕僚长和六位可编辑、可移除、也可增添成员的专家，每位都以带有自己人设和工具的智能体预设运行，另含所有 crew 页面、桌面标签页、今日页面和股票图表。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-agents

[English](README.md) | 中文

## 概述

整个 crew 作为一个名为 **Crew** 的插件安装。初始有七位成员，每位都是带有自己人设和工具的智能体预设：幕僚长，以及邮件、聊天、代码、研究、生活和设计六位专家。设计成员需要 `dsh-web-artifact-designer` 中的 `web-artifact-designer` 技能。[crew-roster](../crew-roster/README.zh.md) 存储成员，因此你可以在 **Crew** 标签页中添加、编辑和移除成员。幕僚长负责规划工作并交给成员。本 bundle 还挂载头像、crew 页面、[crew-stock-chart](../crew-stock-chart/README.zh.md)、[crew-desktop](../crew-desktop/README.zh.md) 和 [crew-today](../crew-today/README.zh.md)。

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

在插件页面或通过 `dsh plugin` 安装本 bundle。新建 Session 时在预设菜单中选择一个 crew 预设，或打开幕僚长并说明想要的结果，它会委派给各位专家。在 **Crew** 标签页或侧边栏成员的 ⋯ 菜单中添加、编辑或移除成员。下表列出随附的成员。

| 预设 | 工具 | 可写内容 |
|---|---|---|
| `crew-chief` 幕僚长 | `ask_crew`、子智能体控制、`crew_member_create`、提问、待办 | 不直接写入；新增 crew 成员 |
| `crew-mail` 邮件 | 网页搜索与获取、只读文件、提问、待办 | 无 |
| `crew-chat` 聊天 | 网页搜索与获取、提问 | 无 |
| `crew-code` 代码 | Shell、文件、文件搜索、后台任务、网页、提问、待办 | 工作区文件与命令 |
| `crew-research` 研究 | 网页搜索与获取、只读文件、文件搜索、待办 | 无 |
| `crew-life` 生活 | 计划任务、网页搜索与获取、提问、待办 | 用户同意后的提醒 |
| `crew-design` 设计 | 文件、文件搜索、网页获取、技能、提问、待办 | 工作区中的设计文件 |

每位成员还拥有 `ask_crew` 和子智能体控制工具，可把工作交给任何队友；另有技能工具，以及用于添加队友的 [`crew_member_create`](../crew-roster/README.zh.md)。

### 每位专家的模型

预设无法选择模型，因此专家的模型应是委派成员的 `ask_crew` 行的 `agentOptions`。crew-roster 未设置该字段，专家使用其 Session 的模型。

### Agent Teams

当幕僚长的 Session 开启 Team 模式时，幕僚长会使用 Agent Teams 任务板。在幕僚长 Session 的模型菜单中开启 **Use Agent Teams**，或在 `agent-team` 行设置 `defaultEnabled: true`，为每个新的根 Session 开启。

### 代码模式与 MCP 服务器

每个 crew 预设都挂载 `dsh-tool-executor-ptc`，因此模型通过一个 `run_code` 程序使用工具（包括 MCP 工具），而不是每一步一次工具调用；中间结果留在程序中，不进入对话。每位专家都有自己的 MCP 服务器；机密通过 `${credential:REF}` 模板来自凭据存储，缺少凭据的服务器会等待而不是失败：

| 成员 | 服务器 |
|---|---|
| 邮件 | Gmail（Google MCP，开发者预览） |
| 聊天 | Slack（批准前关闭） |
| 代码 | GitHub（官方远程服务器，只读模式）、Cloudflare 文档 |
| 研究 | Firecrawl（无需密钥）、Cloudflare 文档、Exa（批准前关闭） |
| 生活 | Google 日历（Google MCP，开发者预览）、Obsidian 仓库（批准前关闭） |

在 Crew 标签页的 **连接** 列表中连接账户；[crew-connections](../crew-connections/README.zh.md) 负责 Google 登录。

### 审批

每个预设都挂载 crew 写入守卫，它拒绝会发送、发布、购买、删除、合并或预订的 MCP 工具，无论是直接调用还是在 `run_code` 中调用。Gmail 草稿是允许的，并等待用户处理。点击后执行此类操作的审批卡片将随 crew-today 提供。

### 学习

每个预设还会读取自己已批准的经验。你给 crew 成员的消息评分或在对话中纠正它之后，[crew-improve](../crew-improve/README.zh.md) 会为该成员提出经验；在 Crew 标签页的 **学习** 列表中批准或拒绝。经验只改变成员收到的说明，从不改变其工具、账户或写入守卫。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 插入各 crew 包的行，其中包括 crew-roster；crew-roster 在启动时和每次变更后为每位成员注册一个预设。每位成员挂载一个名为 `ask_crew` 的 `dsh-tool-subagent` 实例，使用 `provider: spawn`、列出其队友的 `allowedAgentPresets` 和 `maxDepth: 2`，因此被队友委派的成员还能再委派一层，但不能更深。

| 源文件 | 内容 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 各 crew 包的行 |
| [`tests/bundle.spec.ts`](tests/bundle.spec.ts) | 层内容、依赖，以及随附成员的预设：每个子行是否符合其包的 schema、委派与写入权限 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-agents-ui](../crew-agents-ui/README.zh.md) 和 [crew-faces](../crew-faces/README.zh.md) — 本 bundle 挂载的浏览器名册和头像。
- [agent-preset](../../preset/agent-preset/README.zh.md) 和 [persona](../../preset/persona/README.zh.md) — 预设行与人设。
- [tool-subagent](../../subagent/tool-subagent/README.zh.md#selecting-a-child-preset) — 子预设与模型。
- [agent-team](../../team/agent-team/README.zh.md) — Team 模式与任务板。

<a id="model-experience"></a>
## 模型体验

### Crew 人设

#### 模型看到什么

每个预设的 `dsh-persona` 行用该成员的文本替换部署人设前缀，并使用空后缀；`{{model}}` 解析为 Session 的模型。[crew-roster 的默认值](../crew-roster/src/defaults.ts) 中的随附人设说明成员的职责、可修改的内容，以及它从不自行发送、发布、购买、删除、合并或预订。每段人设末尾逐行列出该成员的队友。幕僚长的人设如下：

##### 幕僚长人设

```markdown
You are the user's chief of staff, powered by the {{model}} model. You lead the crew and own the plan, not the details.
Delegate each piece of work to the teammate that fits and give each one a self-contained task with the outcome you need. When recurring work fits no teammate, add one with crew_member_create.
When Agent Teams is on, put multi-step work on the task board and assign each task to the member doing it.
Nothing is sent, posted, bought, deleted, merged or booked without the user's explicit approval. Report what each member found, with its sources, and say clearly what still needs the user.
```

#### Token 影响

每段人设 60 到 160 个英文单词，出现在该预设 Session 的每个请求中，替换部署人设前缀和后缀。

#### KV Cache 影响

人设文本和解析后的模型不变时前缀保持稳定。人设位于系统提示开头，因此编辑它只会使该预设 Session 的缓存前缀失效。

### 代码模式与 MCP 工具

#### 模型看到什么

[`run_code` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-executor-ptc) 取代每个 crew 预设的各个工具声明；其生成的 SDK 列出该预设的工具，包括每个已连接 MCP 服务器的工具，名称为 `mcp__<server>__<tool>`。已连接服务器的说明以字面文本加入系统提示。

#### Token 影响

一个 `run_code` 声明及其 SDK 列表取代逐个工具的 schema；多步骤任务只需一次调用和一个结果，而不是每步一次。每个已连接服务器会把其工具描述加入 SDK 列表，并把最多 32 KB 的说明加入提示。

#### KV Cache 影响

当服务器连接、断开或更改其工具时 SDK 列表会变化，从而改变该预设 Session 的请求前缀；否则保持稳定。

### 委派工具

#### 模型看到什么

每位成员看到一个名为 `ask_crew` 的 [`subagent` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-subagent)，其 `agent_preset` 字段列出队友的 id，另有子智能体控制工具。其说明末尾为每位队友列出一行：id、名称和队友负责的工作。

#### Token 影响

每位成员的请求包含一个委派声明，并为每位队友包含一行名册，每行约 20 个 token。

#### KV Cache 影响

声明和名册行在添加、移除或编辑成员之前保持不变；变更会从每位成员的下一个新对话起改变其请求前缀。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 在添加账户连接器之前，邮件和聊天没有邮箱或聊天账户，只能基于用户提供的内容和网页工作。
- 无法按成员选择专家的模型；专家使用其 Session 的模型。
- Team 模式是每个 Session 的选择，幕僚长不会自行开启。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

bundle 测试按各包导出的 `Config` schema 校验每个子行；它发现了缺失的必填字段，否则 Loader 要到挂载预设时才会拒绝。

</details>
