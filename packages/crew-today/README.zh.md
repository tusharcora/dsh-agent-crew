---
description: "Crew 今日 bundle：只读 Remote，读取本周 Google 日历日程和与用户相关的未合并 GitHub 拉取请求，并挂载今日页面。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-today

[English](README.md) | 中文

## 概述

今日页面汇总 crew 和你的账户关于今天的信息。本 bundle 挂载 [crew-today-ui](../crew-today-ui/README.zh.md) 提供的页面，以及一个只读 Host Remote：从你的主 Google 日历读取本周日程，并读取与你相关的未合并 GitHub 拉取请求，每项都附有来源和获取时间。它不会发送、合并或预订任何内容。

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

从插件页面或用 `dsh plugin` 安装本 bundle。它插入 `crew-today` 和 `crew-today-ui` 两行，无需配置。它读取 [crew-connections](../crew-connections/README.zh.md) 存储的凭据：日历使用 Google 访问令牌，拉取请求使用 `CREW_GITHUB_TOKEN`。缺少凭据时，对应列表返回 `not-connected`，页面会提示你连接账户。

`crewToday` Remote 提供 `calendar()` 和 `pullRequests()`。二者返回 `{ ok: true, items, source: { name, url, fetchedAt } }` 或 `{ ok: false, reason: 'not-connected' | 'failed', message }`。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

`calendar()` 向 Google Calendar API 请求 `primary` 日历上从 Host 时区本周一 00:00 到下周一的单次日程，按开始时间排序，并去掉已取消的日程。`pullRequests()` 在 GitHub 搜索 `is:pr is:open involves:@me archived:false`，按更新时间倒序，最多 20 条。

| 源码 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务与 Remote |
| [`src/fetch.ts`](src/fetch.ts) | Google 日历与 GitHub 读取 |
| [`src/types.ts`](src/types.ts) | 共享结果类型 |
| [`cordis.patch.yml`](cordis.patch.yml) | Bundle 行 |
| [`tests/`](tests/) | 解析、未连接与失败路径 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-connections](../crew-connections/README.zh.md)——Google 登录和 GitHub 令牌的存储位置。
- [crew-today-ui](../crew-today-ui/README.zh.md)——今日页面。

<a id="model-experience"></a>
## 模型体验

无，本包只响应浏览器的 Remote 调用，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 只读取主日历。
- 拉取请求只来自 GitHub，不列出其他代码托管平台。
- 每次加载页面都会重新获取，不做缓存。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用记录的响应形状替换 `fetch`；没有测试会调用 Google 或 GitHub。

</details>
