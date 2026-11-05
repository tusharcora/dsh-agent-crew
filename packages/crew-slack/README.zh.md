---
description: "Crew Slack：在这台电脑运行 dsh 时于 Slack 中提及 crew；每个话题串是与所点名成员的 dsh Session，每条回复都需你批准后才会发布。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-slack

[English](README.md) | 中文

## 概述

让你在这台电脑运行 dsh 时从 Slack（包括手机上的 Slack 应用）呼叫 crew。由这台电脑发起的 Socket Mode 连接接收对 Crew 应用的提及和发给它的私信。以成员名称开头的消息交给该成员；否则由幕僚长回答。每个 Slack 话题串是一个 dsh Session。回复会成为草稿，并在你的 Slack 私信和 Crew 标签页中附带审批卡片；在你点击 **发布回复** 之前不会发布任何内容。

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

[crew-agents](../crew-agents/README.zh.md) bundle 以 `~/.dsh/crew` 为目录挂载本包。

1. 在 [api.slack.com/apps](https://api.slack.com/apps) 选择 **Create New App → From an app manifest**，选择你的工作区并粘贴 [`slack-app.yml`](slack-app.yml)。
2. 在 **Basic Information → App-Level Tokens** 下生成带 `connections:write` 的令牌（以 `xapp-` 开头）。
3. **Install to Workspace**，然后复制 **Bot User OAuth Token**（`xoxb-`）。
4. 在 Slack 中打开你的个人资料，选择 **⋯ → Copy member ID**（`U…`）。
5. 在 dsh 的 **Crew** 标签页中，在 **Slack** 下保存这三个值并点击 **重新连接**。把 `@Crew` 邀请到你想使用它的频道。

之后在频道中写 `@Crew Code, why is CI red?`，或直接给 Crew 发私信。只回答你以及 `allowedUsers` 中的 Slack 用户；其他人的消息会被忽略。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `homeDirectory` | 必填 | 存放 `slack.json`（话题串和草稿）的目录 |
| `allowedUsers` | `[]` | 除你之外，crew 会回答的 Slack 成员 id |
| `fallbackMember` | `crew-chief` | 未点名任何人的新话题串由哪位成员回答 |
| `replyTimeoutMinutes` | `30` | 等待成员回复的时长 |
| `keepDrafts` | `50` | 文件中保留的草稿数 |

| Remote | 返回 |
|---|---|
| `status()` | `{ state, detail?, drafts }` |
| `reconnect()` | 重新连接后的状态 |
| `decide(id, action, text?)` | 发布草稿（可先编辑）或舍弃它 |

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`CrewSlack` 是位于 `crewSlack` 下的 `TypertRemoteService`。它从凭据存储中读取应用令牌、机器人令牌和所有者 id（`CREW_SLACK_APP_TOKEN`、`CREW_SLACK_BOT_TOKEN` 和 `CREW_SLACK_OWNER_ID`），用 `auth.test` 校验机器人令牌，并通过 `apps.connections.open` 打开 Socket Mode WebSocket。每个信封都会立即确认；连接关闭后 5 秒重连，令牌被拒绝时一分钟后重试。

`route` 根据消息开头的词选择成员，并让话题串保持同一位成员；点名另一位成员的话题串会开启新的 Session。话题串的第一条消息通过 `ctx.sessionController.create` 在 crew-connections 提供的成员文件夹中创建 Session，每条消息都通过 `ctx.sessionController.prompt` 送入，因此对话会像其他对话一样出现在 dsh 中。服务等待该轮次的 `turn/end`，并把最后的助手文本作为草稿。`decide` 是唯一会对话题串调用 `chat.postMessage` 的路径；所有者以外的人的按钮点击会被忽略。

| 源码 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、Remote、Session 与草稿 |
| [`src/slack.ts`](src/slack.ts) | Web API 调用、信封解析、路由和审批卡片 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的类型 |
| [`slack-app.yml`](slack-app.yml) | Slack 应用清单 |
| [`tests/`](tests/) | 解析、路由，以及基于伪 Slack 的提及到发布流程 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-agents-ui](../crew-agents-ui/README.zh.md) — Crew 标签页中的 Slack 卡片。
- [crew-roster](../crew-roster/README.zh.md) — 消息可点名的成员。
- [Slack Socket Mode](https://api.slack.com/apis/socket-mode)。

<a id="model-experience"></a>
## 模型体验

### Slack 提示

#### 模型看到的内容

每条 Slack 消息以普通用户消息的形式进入成员的 Session：

##### Slack 消息

```markdown
Slack message from <@U012345> in <#C012345>:

why is CI red?

Reply the way you would in Slack to a teammate: short, plain sentences, no headings or reports. The user approves your reply before it is posted, so write only the message itself.
```

#### Token 影响

每条 Slack 消息外围约 60 个 token；回复从该轮次中读取，不会再发回模型。

#### KV Cache 影响

每条 Slack 消息像输入的消息一样追加到 Session 中，因此之前的轮次保持为稳定前缀。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 只有在这台电脑唤醒且 dsh 运行时才会回答；Slack 不会为之后保留任何内容。
- 频道消息需要提及 `@Crew`；话题串中未提及的后续消息不会被看到。
- 编辑在 Crew 标签页中进行；Slack 卡片只提供发布回复和舍弃。
- Slack 消息中的文件和图片不会被传递。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试替换 `internals.fetch` 和 `internals.WebSocket`；没有请求离开本机。

</details>
