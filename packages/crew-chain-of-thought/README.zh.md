---
description: "聊天中的思考链卡片：实时显示每个回合的推理、工具调用、用时和来源。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-chain-of-thought

[English](README.md) | 中文

## 概述

智能体的长回合会把工作隐藏在问题和回答之间。本客户端插件在每个有推理或工具调用的回合开头添加一张卡片：每个步骤一行，显示每段推理的第一句、每次工具调用及其关键参数、用时、是否失败，以及结果中包含的链接域名。回合运行期间卡片展开并显示实时的 **工作中** 计时；结束后折叠为一行，点击可展开。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载本插件；无需配置，在所有 Session 中显示。没有推理或工具调用的回合不显示卡片。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

一个会话 Definition 按回合匹配 `turn/start`、`assistant/message`、`tool/call`、`tool/result` 和 `turn/end`，并折叠为 `{ turn, startedAt, endedAt?, steps }`。它发布锚定在回合开头的 `crew-chain` Chat 节点，通过带键的 `conversation.chat.node` 插槽渲染。关键参数取 `query`、`url`、`command` 等字符串参数中的第一个；来源是结果文本中 http(s) 链接的不同域名，最多六个。所有内容都读自 Session 日志，因此回放会重建卡片。

| 源码 | 内容 |
|---|---|
| [`src/client/chain.ts`](src/client/chain.ts) | 回合 Definition 与折叠 |
| [`src/client/ChainCard.tsx`](src/client/ChainCard.tsx) | 卡片 |
| [`src/client/index.ts`](src/client/index.ts) | 注册 |
| [`tests/`](tests/) | 折叠与卡片状态 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [ui-workflow-run](../../client/ui-workflow-run/README.zh.md)——本包沿用的 Chat 节点模式。
- [ui-trajectory](../../client/ui-trajectory/README.zh.md)——完整的时间检查器。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器卡片，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 卡片会重复聊天中已有的工具行；它是摘要而非替代。
- 来源是结果文本中找到的链接域名，而不是工具声明的引用列表。
- 只有模型返回推理块时才显示推理。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用真实事件结构折叠合成事件，并用假计时器渲染卡片以检查实时时钟。

</details>
