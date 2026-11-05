---
description: "Crew 账户连接：通过授权接缝为 Gmail 和日历 MCP 服务器登录 Google、刷新访问令牌，以及每个 crew 预设挂载的写入守卫。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-connections

[English](README.md) | 中文

## 概述

crew 成员通过 MCP 服务器读取邮件、日历和代码。本包通过 dsh 的授权接缝为 Gmail 和日历服务器登录 Google，在凭据存储中保持访问令牌有效，并为 Crew 标签页提供连接和断开连接的 Remote。其 `./guard` 入口挂载在每个 crew 预设中，拒绝会发送、发布、购买、删除、合并或预订的 MCP 工具，无论模型是直接调用还是在 `run_code` 程序中调用。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载该服务，并在每个 crew 预设中放入守卫。在右侧面板 **Crew** 标签页的 **连接** 列表中连接账户。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `homeDirectory` | 必填；bundle 设为 `<dsh home>/crew` | 为不属于任何 Workspace 的对话存放每位成员目录的文件夹 |
| `googleRedirectUri` | `http://127.0.0.1:8765/oauth2callback` | 在 Google OAuth 客户端上注册的回环重定向地址 |
| `refreshMarginSeconds` | `300` | 在访问令牌过期前多少秒刷新，至少 60 |
| `signInTimeoutSeconds` | `300` | 登录等待浏览器的时长，至少 30 |

### Google

Google 的 Gmail 和日历 MCP 服务器处于 Workspace 开发者预览阶段。创建标记为 AI 智能体的 **Web 应用** OAuth 客户端，注册上述重定向地址，加入预览，然后在 Crew 标签页保存客户端 ID 和密钥并选择 **使用 Google 登录**。权限范围为 `gmail.readonly`、`gmail.compose`、`calendar.calendarlist.readonly`、`calendar.events.freebusy` 和 `calendar.events.readonly`，均无法发送邮件。

### 凭据

| 引用或记录 | 内容 |
|---|---|
| `CREW_GOOGLE_CLIENT_ID`、`CREW_GOOGLE_CLIENT_SECRET` | 从 Crew 标签页保存的 OAuth 客户端 |
| `crew-connections/google` 记录 | 刷新令牌、访问令牌及其过期时间 |
| `CREW_GOOGLE_ACCESS_TOKEN` | 当前访问令牌，由 Gmail 和日历 MCP 行读取 |
| `CREW_GITHUB_TOKEN` | 从 Crew 标签页保存的 GitHub 令牌，由 GitHub MCP 行读取 |

`crewConnections` Remote 提供 `googleStatus()`、`connectGoogle()` 和 `disconnectGoogle()`（均不返回机密），以及 `memberDirectory(member)`，它创建并返回成员不属于任何 Workspace 的对话所运行的文件夹。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

该服务为 `crew-connections/google` 注册一个授权流程。每次尝试创建 PKCE 对和 state，在回环重定向地址上监听一次，通过 `notify` 报告同意页面 URL，以 `access_type=offline` 交换授权码，通过会话提交授权记录并发布访问令牌。`connectGoogle` 以一个把该 URL 返回给浏览器并拒绝任何提问的交互开始尝试。每分钟一次，在过期前余量内的令牌会在 `modifyRecord` 中刷新，因此两个进程不会把同一个刷新令牌轮换两次；失败会通过 `googleStatus().lastError` 报告。

守卫把 `mcp__<server>__<tool>` 名称拆分为单词，当某个单词表示对 dsh 之外的更改时拒绝该工具，例如 `send`、`post`、`delete`、`merge`、`push`、`create`、`book` 或 `buy`。Gmail 的 `create_draft` 是唯一允许的例外：草稿会等待用户处理。内置工具遵循其自身策略。`ctx.tools.guard` 在共享管线中的前置策略之后运行，原生和 PTC 执行器都使用该管线。

| 源文件 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、流程、刷新与 Remote |
| [`src/google.ts`](src/google.ts) | OAuth URL、PKCE、令牌调用与回环重定向 |
| [`src/guard.ts`](src/guard.ts) | 写入守卫插件 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的状态类型 |
| [`tests/`](tests/) | 守卫规则与注册表拒绝、OAuth 辅助函数、登录、刷新与断开连接 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [authorization](../../credentials/authorization/README.zh.md) — 流程与尝试。
- [mcp-client](../../mcp/mcp-client/README.zh.md#runtime-templates-and-credentials) — `${credential:REF}` 模板。
- [crew-agents](../crew-agents/README.zh.md) — 预设及其 MCP 行。

<a id="model-experience"></a>
## 模型体验

### 写入守卫拒绝

#### 模型看到什么

被拒绝的 MCP 调用以失败结束，消息先指明工具和服务器，随后是下面的指引。

##### 拒绝指引

```markdown
would change something outside dsh. Crew members never send, post, buy, delete, merge or book on their own. Prepare the change (for example a draft), show it to the user and ask them to approve it.
```

#### Token 影响

每次被拒绝的调用约 50 个 token；允许的调用不增加任何内容。

#### KV Cache 影响

拒绝是追加到历史中的普通工具结果，不会改变之前的消息或工具声明。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- Google 的 Gmail 和日历 MCP 服务器处于开发者预览阶段，需要用户自己的 Google Cloud 项目和 OAuth 客户端。
- 守卫依据工具名称判断，因此写入工具名称中性的服务器不在覆盖范围内；GitHub 还在服务器端以只读模式连接。
- Code 预设中的 `bash` 等内置工具不由此处守卫，它们遵循 dsh 的沙箱和审批策略。
- 草稿操作的审批卡片将随 crew-today 提供；在此之前，模型在对话中请用户确认。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

登录测试驱动真实的授权与本地凭据插件以及真实的回环重定向，只模拟 Google 的令牌端点。

</details>
