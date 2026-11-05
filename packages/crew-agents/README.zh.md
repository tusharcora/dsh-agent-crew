---
description: "Crew 智能体预设：邮件、聊天、代码、研究和生活五位专家各有自己的人设和工具，另有一位把工作委派给他们的幕僚长。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-experimental-crew-agents

[English](README.md) | 中文

## 概述

Crew 由六个智能体预设组成。五位专家各有自己的人设和工具：邮件、聊天、代码、研究和生活。幕僚长负责规划工作，并通过各自的 `ask_*` 委派工具把每项工作交给一位专家。本 bundle 还挂载智能体头像和浏览器端名册，名册的右侧面板 **Crew** 标签页显示每位成员的头像、名称和实时状态。

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

在插件页面或通过 `dsh plugin` 安装本 bundle。新建 Session 时在预设菜单中选择一个 crew 预设，或打开幕僚长并说明想要的结果，它会委派给各位专家。

| 预设 | 工具 | 可写内容 |
|---|---|---|
| `crew-chief` 幕僚长 | `ask_mail`、`ask_chat`、`ask_code`、`ask_research`、`ask_life`、子智能体控制、提问、待办 | 不直接写入 |
| `crew-mail` 邮件 | 网页搜索与获取、只读文件、提问、待办 | 无 |
| `crew-chat` 聊天 | 网页搜索与获取、提问 | 无 |
| `crew-code` 代码 | Shell、文件、文件搜索、后台任务、网页、提问、待办 | 工作区文件与命令 |
| `crew-research` 研究 | 网页搜索与获取、只读文件、文件搜索、待办 | 无 |
| `crew-life` 生活 | 计划任务、网页搜索与获取、提问、待办 | 用户同意后的提醒 |

### 每位专家的模型

预设无法选择模型，因此每位专家的模型是幕僚长预设中对应 `ask_*` 行的 `agentOptions`。随附的行未设置该字段，专家使用其 Session 的模型。如需固定模型，在 profile patch 中为该行添加带 `provider` 和 `model` 的 `agentOptions`；`list_subagent_models` 列出部署提供的路由。

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

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

[`cordis.patch.yml`](cordis.patch.yml) 插入头像行、浏览器名册行和六个 `dsh-agent-preset` 行。幕僚长为每位专家挂载一个 `dsh-tool-subagent` 实例，使用 `provider: spawn`、独立的 `toolName` 和固定的 `agentPreset`，因此每项委派都有自己的工具和模型设置。专家不挂载委派工具，委派深度止于一层。

| 源文件 | 内容 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 预设行、人设、代码模式、写入守卫与 MCP 行 |
| [`tests/bundle.spec.ts`](tests/bundle.spec.ts) | 层内容、依赖、每个子行配置是否符合其包的 schema、委派与写入权限 |

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

每个预设的 `dsh-persona` 行用该成员的文本替换部署人设前缀，并使用空后缀；`{{model}}` 解析为 Session 的模型。[`cordis.patch.yml`](cordis.patch.yml) 中的专家人设说明成员的职责、可修改的内容，以及它从不自行发送、发布、购买、删除、合并或预订。幕僚长的人设如下：

##### 幕僚长人设

```markdown
You are the user's chief of staff, powered by the {{model}} model. You lead a crew of five specialists and own the plan, not the details.
Delegate each piece of work to the specialist that fits with its ask_* tool: ask_mail for email, ask_chat for messages, ask_code for repositories and pull requests, ask_research for questions that need sources, ask_life for calendar, errands and reminders. Give each one a self-contained task with the outcome you need.
When Agent Teams is on, put multi-step work on the task board and assign each task to the specialist doing it.
Nothing is sent, posted, bought, deleted, merged or booked without the user's explicit approval. Report what each specialist found, with its sources, and say clearly what still needs the user.
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

幕僚长看到五个名为 `ask_mail`、`ask_chat`、`ask_code`、`ask_research` 和 `ask_life` 的 [`subagent` 声明](../../../docs/tool-catalog.zh.md#deepseek-aidsh-tool-subagent)，每个都以固定预设启动子智能体，另有子智能体控制工具。没有行设置 `allowedAgentPresets`，因此声明中不含 `agent_preset` 字段。

#### Token 影响

幕僚长的每个请求包含五个委派声明，专家不包含。

#### KV Cache 影响

声明对幕僚长预设固定，在其各轮次之间保持请求前缀稳定。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 在添加账户连接器之前，邮件和聊天没有邮箱或聊天账户，只能基于用户提供的内容和网页工作。
- 专家的模型按委派行而非按预设设置，因此直接在专家预设上打开的 Session 使用自身的 Session 模型。
- Team 模式是每个 Session 的选择，幕僚长不会自行开启。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

bundle 测试按各包导出的 `Config` schema 校验每个子行；它发现了缺失的必填字段，否则 Loader 要到挂载预设时才会拒绝。

</details>
