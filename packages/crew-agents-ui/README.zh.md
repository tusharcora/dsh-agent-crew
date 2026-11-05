---
description: "Crew 的浏览器端名册：每位成员的名称、头像和实时状态、Session 启动，以及添加、编辑和移除成员，供其他 crew 插件共用。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-agents-ui

[English](README.md) | 中文

## 概述

本客户端插件提供 `ctx.crew`：由 [crew-roster](../crew-roster/README.zh.md) 存储的 crew 成员，及其头像、名称和由 Session 列表与 Session 状态汇总的实时状态（工作中、需要你或空闲），并提供与成员新建 Session 的方法。它在 Workspace 上方绘制 **Crew** 区块，在 crew Session 的聊天标题中显示徽标，并在右侧面板提供 **Crew** 标签页，可在其中添加、编辑和移除成员。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载此行。浏览器插件注入 `crew` 并读取：

| 成员 | 含义 |
|---|---|
| `members` | 可观察的名册：每位成员的 `{ id, name, face, status, sessions, open, home, focus }`，按名册顺序 |
| `name(id)` | 成员名称；随附成员在改名前显示翻译后的名称 |
| `design(id)` | 成员头像；不在名册中的 ID 返回 undefined |
| `statusLabel(state)` | 本地化的“工作中”“需要你”或“空闲” |
| `openChat(id)` | 打开该成员的焦点 Session，若没有则创建其不属于任何 Workspace 的对话 |
| `startInWorkspace(id, workspaceId)` | 在某个 Workspace 中与该成员新建对话 |
| `roster`、`refresh()` | 来自 [crew-roster](../crew-roster/README.zh.md) 的成员记录与可选连接，以及重新读取 |
| `save(member)`、`remove(id)` | 添加（空 ID）、更新或移除成员；各自返回结果或要显示的消息 |
| `requestEdit(id)` | 请求 Crew 标签页打开某位成员的编辑器，传入 `''` 则新建成员 |

使用 [crew-faces](../crew-faces/README.zh.md) 的 `ctx.crewFaces.Face` 绘制成员，把成员 ID 作为 `agentId`、其 `face` 作为 `design` 传入，状态为 `working` 时传入 `mood="working"`。

### 头像

| 成员 | 身体 | 颜色 |
|---|---|---|
| 幕僚长 | orb | `#0B0B0C`，白色眼睛 |
| 邮件 | block | `#E8B4A0` |
| 聊天 | bean | `#C9B6E4` |
| 代码 | drop | `#4D6BFE` |
| 研究 | orb | `#A8C7A1` |
| 生活 | bean | `#F2D16B` |

每位成员的头像是其记录的一部分，可在编辑器中修改；下表列出随附的头像。成员工作时眼睛向右上方移动。

### Crew 区块与聊天标题

区块使用 `sidebar.sections` 插槽，列出所有成员（包括空闲成员），成员工作中或需要你时显示状态标签。每位成员都有自己的对话：一个不属于任何 Workspace 的 Session，运行在 [crew-connections](../crew-connections/README.zh.md) 提供的成员文件夹中，首次打开时创建。点击一行会打开等待你的 Session，其次是正在运行的，否则是该成员自己的对话。**⋯** 菜单可打开其自己的对话、在任意 Workspace 中与该成员新建对话，或打开 **编辑成员**；标题旁的 **+** 用于添加成员。两者都会在 Crew 标签页中打开编辑器。折叠的轨道只显示头像，但仍为辅助技术和提示提供名称。

徽标使用 `conversation.session.header.actions`，只出现在运行 crew 预设的 Session 中。

### 连接

在名册下方，Crew 标签页列出 crew 的 MCP 连接、各自的使用者以及文字状态。Google 需要 OAuth 客户端 ID 和密钥，然后 **使用 Google 登录** 打开 Google 的同意页面；GitHub 需要一个令牌。机密发送到 Host 凭据存储，从不回显：已保存的显示为已保存，可以替换或移除。无需密钥的服务器显示 **无需账户**，等待你批准的服务器显示 **在你批准前保持关闭**。

### Crew 标签页

在任意 Session 中从右侧面板的引导页打开 **Crew**。每行显示成员的头像、名称、文字状态（工作中、需要你或空闲）、Session 数量和一个 **新建会话** 按钮，用该成员的预设新建 Session。

行上的 **编辑** 和列表下方的 **添加 crew 成员** 会打开编辑器：名称、负责的工作（幕僚长据此决定把工作交给谁）、说明、每条消息的工具调用次数（0 表示不限）、头像形状和颜色、文件访问、运行命令、获取网页、定时任务和连接。尚未批准账号的连接显示为关闭。幕僚长可以改名和修改说明，但不能移除，其工具也固定不变。**移除** 会再确认一次，过往对话会保留。保存后对新对话生效；正在运行的对话保持其启动时的设置。

### 学习

在名册和连接之间，**学习** 列表显示 crew 成员通过 [crew-improve](../crew-improve/README.zh.md) 提出的经验。每条提议显示其成员、经验内容、引用的依据、来自评分还是对话及时间，以及将被替换的经验；用 **批准** 和 **拒绝** 处理。已批准的经验列出批准时间和 **移除** 按钮。列表打开时每 30 秒重新读取一次；不点击就不会有任何更改。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

当 Session 列表中的 `agentPreset` 投影值等于成员的预设 ID 时，该 Session 属于此成员。只要成员的任一 Session 有待处理交互（如未回答的问题或审批），成员即为 `needs-you`；否则只要任一 Session 在运行即为 `working`；否则为 `idle`。`uiSession.sessionStatus` 的实时运行状态优先于列表的运行标记。名册快照在成员状态或 Session 列表变化前保持同一引用，因此 React 选择器只在真正变化时重新渲染。

| 源文件 | 内容 |
|---|---|
| [`src/roster.ts`](src/roster.ts) | 状态汇总 |
| [`src/client/index.ts`](src/client/index.ts) | 注册 |
| [`src/client/crew-roster.ts`](src/client/crew-roster.ts) | `ctx.crew` 服务与打开对话 |
| [`src/client/CrewPanel.tsx`](src/client/CrewPanel.tsx)、[`src/client/MemberEditor.tsx`](src/client/MemberEditor.tsx) | Crew 标签页与成员编辑器 |
| [`src/client/CrewSection.tsx`](src/client/CrewSection.tsx) | 侧边栏区块 |
| [`src/client/CrewLearning.tsx`](src/client/CrewLearning.tsx)、[`src/client/learning.ts`](src/client/learning.ts) | 学习列表及其存储 |
| [`src/client/CrewHeader.tsx`](src/client/CrewHeader.tsx) | 聊天标题徽标 |
| [`src/client/locales.ts`](src/client/locales.ts) | 名称、状态标签与标签页文案 |
| [`tests/`](tests/) | 汇总与服务测试 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-roster](../crew-roster/README.zh.md) — 存储的成员及其预设。
- [crew-agents](../crew-agents/README.zh.md) — bundle。
- [crew-faces](../crew-faces/README.zh.md) — 成员头像。
- [ui-session](../../client/ui-session/README.zh.md) — Session 状态来源。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器端名册，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 只计入浏览器 Session 列表中的 Session；列表未保留的委派子智能体不会改变其成员的状态。
- 窗口重新获得焦点时会重新读取名册，因此在其他窗口或设备上的修改会在切回后显示。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

无。

</details>
