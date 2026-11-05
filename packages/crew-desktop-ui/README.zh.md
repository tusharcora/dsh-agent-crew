---
description: "crew 桌面的浏览器端：右侧面板的桌面标签页，显示最新的工具结果截图、电脑使用的运行位置，以及暂停、接管和恢复。"
kind: "package-reference"
---

# @deepseek-ai/dsh-crew-desktop-ui

[English](README.md) | 中文

## 概述

本客户端插件在右侧面板添加 **桌面** 标签页。它显示 Session 中任意工具返回的最新截图，并标注工具和时间，同时显示电脑使用的运行位置以及智能体是否在工作。**暂停** 停止当前轮次；**接管** 停止它并显示由你控制，直到你恢复或发送消息。画面在每次智能体操作后更新，不是实时画面。

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

[crew-desktop](../crew-desktop/README.zh.md) bundle 挂载此行。在任意 Session 中从右侧面板的引导页打开 **桌面**。

| 控件 | 作用 |
|---|---|
| **暂停** | 通过 Session 的取消停止智能体当前轮次；智能体工作时可用 |
| **接管** | 停止正在运行的轮次，然后显示 **由你控制** |
| **恢复** | 清除由你控制的提示；你发送消息后智能体继续 |

新的轮次（例如你发送消息后）也会结束由你控制的提示。如果停止失败，标签页会说明，智能体继续控制。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

标签页读取 Session 已加载的事件窗口。画面是最新 `tool/result` 中最后一个 `image` 块，以对应的 `tool/call` 命名；已卸载的图片会被跳过。图片字节来自 Session 的 `readAttachment`，以 data URL 显示。模型为每个 Session 绑定保留一份桌面状态，只在标签页打开时跟随其来源，并只读取一次 `crewDesktop.where()` 的位置。

| 源文件 | 内容 |
|---|---|
| [`src/client/frame.ts`](src/client/frame.ts) | 画面选择与图片编码 |
| [`src/client/desktop-model.ts`](src/client/desktop-model.ts) | 每个 Session 的状态、暂停、接管与恢复 |
| [`src/client/DesktopTab.tsx`](src/client/DesktopTab.tsx) | 标签页内容 |
| [`src/client/index.ts`](src/client/index.ts) | 标签页类型、Remote 与插槽注册 |
| [`src/client/locales.ts`](src/client/locales.ts) | 文案 |
| [`tests/`](tests/) | 画面选择、状态、标签与停止 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [crew-desktop](../crew-desktop/README.zh.md) — bundle 及其 Remote。
- [ui-sidebar-right](../../client/ui-sidebar-right/README.zh.md) — 右侧面板标签页。
- [session-controller](../../api/session-controller/README.zh.md) — 取消与附件。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器标签页，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 画面只来自工具返回的图片，因此在智能体截图之前标签页没有内容；连续画面（例如通过 VNC）留待以后。
- 只搜索 Session 已加载的部分；更早的截图不会显示。
- 接管不会锁定电脑；它停止智能体并标明由你控制。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

测试用手工构造的事件窗口和 Session 驱动标签页。

</details>
