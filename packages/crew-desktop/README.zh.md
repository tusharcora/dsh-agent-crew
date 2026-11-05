---
description: "Crew 桌面 bundle：报告运行中的电脑使用提供方及所在机器的 Remote，与右侧面板的桌面标签页一同挂载。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-crew-desktop

[English](README.md) | 中文

## 概述

使用电脑的智能体会操作你平时看不到的屏幕。本 bundle 挂载 [crew-desktop-ui](../crew-desktop-ui/README.zh.md) 提供的右侧面板 **桌面** 标签页，显示智能体最近截取的屏幕，并提供一个 Host Remote，告诉标签页注册了哪个电脑使用提供方、运行在哪台机器上，方便你暂停智能体或接管。

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

从插件页面或用 `dsh plugin` 安装本 bundle。它插入 `crew-desktop` 和 `crew-desktop-ui` 两行，无需配置。只有挂载了电脑使用提供方（例如可选的电脑使用 bundle）时，智能体才能操作电脑；没有时标签页会说明。

`crewDesktop` Remote 提供 `where()`，返回 `{ provider?, host, platform }`：挂载期间注册的 `ctx.computerUse` 提供方名称，以及 Host 机器名和操作系统。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

该服务用 `ctx.inject` 跟随 `ctx.computerUse`，因此没有电脑使用时也能挂载，并在提供方注册后开始报告。`where()` 在调用时读取 `providerName`。

| 源文件 | 内容 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务与 Remote |
| [`src/types.ts`](src/types.ts) | `DesktopLocation` |
| [`cordis.patch.yml`](cordis.patch.yml) | Bundle 行 |
| [`tests/`](tests/) | 提供方与主机报告 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [computer-use](../../computer-use/computer-use/README.zh.md) — 提供方注册表。
- [crew-desktop-ui](../crew-desktop-ui/README.zh.md) — 桌面标签页。

<a id="model-experience"></a>
## 模型体验

无，本包只向浏览器报告提供方和主机，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- Remote 报告提供方名称，但不报告该提供方是否拥有所需的操作系统权限。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

Host 测试提供一个假的 `computerUse` 服务，检查名称随其出现和消失。

</details>
