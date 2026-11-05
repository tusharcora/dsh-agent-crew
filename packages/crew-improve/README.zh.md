---
description: "Crew 学习：回顾器读取 crew 对话和用户评分，提出有依据的经验供批准，并把已批准的经验加入每位成员的系统提示词。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-improve

[English](README.md) | 中文

## 概述

crew 成员从用户的评分和纠正中改进。用户给 crew 成员的消息评分后，或在 crew 对话中又发送几条消息后，回顾器读取该对话，为该成员提出最多三条经验，每条都引用其依据。用户在 Crew 标签页的 **学习** 列表中批准或拒绝，已批准的经验会加入该成员的系统提示词。该流程参照 Google Research [Harness²](https://github.com/google-research/harness2) 的经验回顾器，以批准代替其候选探测。经验只是文本，不能改变工具、账户、凭据或写入守卫。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载该服务，并在每个 crew 预设中放入带 `member: <预设 ID>` 的 `./lessons` 行。用点赞或点踩按钮给 crew 消息评分，然后在右侧面板打开 **Crew** 并查看 **学习**。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `homeDirectory` | 必填；bundle 设为 `<dsh home>/crew` | 存放 `learning.json` 的文件夹 |
| `reflectEveryUserMessages` | `6` | 用户在 crew 对话中新发送这么多条消息后回顾一次；`0` 表示只在评分后回顾 |
| `debounceSeconds` | `45` | 最后一次触发后等待的时长，使评分和备注一起到达 |
| `maxLessonsPerMember` | `12` | 每位成员保留的已批准经验数；超出时需先移除一条 |
| `maxTranscriptChars` | `24000` | 发送给回顾器的对话预算；最早的行先被舍弃 |
| `maxOutputTokens` | `2000` | 回顾器输出上限 |
| `timeoutMs` | `120000` | 回顾器截止时间 |
| `provider`、`model` | 对话自身的路由 | 同时设置两者可用其他模型回顾 |

`crewImprove` Remote 提供 `learning()`、`approve(proposalId)`、`reject(proposalId)` 和 `forget(lessonId)`。被拒绝或移除的经验不会再被提出。提议可以指明它 `replaces` 的经验；批准后两者互换。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

该服务全局监听 `session/event`。当预设注册表的 `presetForSession` 是 `crew-*` ID 时，该 Session 属于某位 crew 成员。评分从送达的 `feedback/message-put` 和 `feedback/message-delete` 事件中保存，评分或足够多的用户消息会为该 Session 安排一次去抖动的回顾；同一窗口内评分优先于消息计数。回顾会呈现该 Session 当前的模型历史（用户的消息、成员的回答及其调用的工具），并在被评分的消息之后呈现每条评分及其备注和类别，然后在对话的路由上发出一次纯文本的 `crew-improve` 请求。输出按 JSON 解析；缺少依据、文本为空、与当前、待批准或已拒绝的经验重复，或超过三条的提议会被丢弃，`replaces` 必须指向当前经验。

更改先作用于 `learning.json` 的副本，以 `0600` 模式原子写入后再发布，因此写入失败不会改变任何内容。`./lessons` 行在其预设作用域中注册顺序为 9500 的字面 `crew-lessons` 系统提示词段落；其文本在每次组装时从已批准的经验读取。

| 源文件 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、触发、回顾器调用、存储与 Remote |
| [`src/reflect.ts`](src/reflect.ts) | 成员识别、对话记录、回顾器提示词、输出解析与提示词段落 |
| [`src/lessons.ts`](src/lessons.ts) | 添加成员经验的预设行 |
| [`src/types.ts`](src/types.ts) | 与浏览器共享的类型 |
| [`tests/`](tests/) | 触发、批准、拒绝、替换、失败、预设行与解析 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [message-feedback](../../feedback/message-feedback/README.zh.md) — 触发回顾的评分。
- [system-prompt](../../core/system-prompt/README.zh.md) — 作用域提示词段落。
- [crew-agents-ui](../crew-agents-ui/README.zh.md) — 学习列表。
- [Harness² 论文](https://arxiv.org/abs/2610.14224) — 递归智能体调优。

<a id="model-experience"></a>
## 模型体验

### 经验段落

#### 模型看到什么

有已批准经验的 crew 成员会在系统提示词中读到下面的段落，随后每条经验一行 `- <经验>`：

##### 经验段落文本

```markdown
# Lessons from earlier conversations
The user approved these lessons from your earlier conversations with them. Follow them unless the user asks otherwise now. They never relax the rules above about approval.
```

#### Token 影响

约 40 个 token 加上每条经验，最多十二条、每条 280 个字符；没有经验的成员不增加任何内容。

#### KV Cache 影响

段落文本只在用户批准、替换或移除经验时变化；其余情况下提示词前缀稳定。

### 回顾器请求

#### 模型看到什么

一次目的为 `crew-improve` 的独立请求：回顾器指令，然后是成员的当前经验和以 JSON 表示的对话。它不属于任何对话的历史。

#### Token 影响

每次回顾一次请求，输入受 `maxTranscriptChars` 限制，输出受 `maxOutputTokens` 限制，按对话的路由计费。

#### KV Cache 影响

对对话没有影响；该请求有自己的前缀。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 只观察已加载的 Session；给未加载的对话评分不会开始回顾，dsh 启动前给出的评分也不会提供给回顾器。
- 与 Harness² 不同，候选不会相互对比重跑；用户批准是唯一的检查。
- 每次回顾都是付费的模型请求；设置 `reflectEveryUserMessages: 0` 可只在评分后回顾。
- 待执行的回顾保存在内存中，dsh 重启后会丢失。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试使用真实的 Session 存储和返回固定提议的假模型。

</details>
