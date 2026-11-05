---
description: "Crew 智能体的 SVG 头像：四种身体之一、一种颜色和两只会眨的胶囊形眼睛，均由智能体 ID 确定性地推导。"
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-faces

[English](README.md) | 中文

## 概述

Crew 界面把每个智能体显示为一个小头像。`CrewFace` 在 100x100 的 viewBox 上以 SVG 绘制它：四种身体（orb、block、drop、bean）之一，六种颜色之一，两只胶囊形眼睛，每隔几秒眨一次眼。智能体 ID 决定身体、颜色和眨眼相位，因此同一智能体在重新加载和不同机器上保持相同头像。头像没有背景形状。

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

[crew-agents](../crew-agents/README.zh.md) bundle 挂载本客户端插件。它提供 `ctx.crewFaces`；浏览器插件注入 `crewFaces`，并用其 `Face` 组件绘制头像：

```tsx
const { Face } = ctx.crewFaces

<Face agentId={agent.id} mood={agent.working ? 'working' : 'idle'} size={32} label={t('crew.face', { name: agent.name })} />
```

| 属性 | 默认值 | 含义 |
|---|---|---|
| `agentId` | 必填 | 稳定的智能体 ID；决定身体、颜色和眨眼相位 |
| `mood` | `idle` | `working` 使两只眼睛向右上方移动 |
| `design` | 未设置 | `{ body, color }`，替换由 ID 推导的身体和颜色；眨眼相位仍由 ID 决定 |
| `size` | `40` | 宽度和高度，单位为 CSS 像素 |
| `label` | 未设置 | 已本地化的无障碍名称；未提供时头像为装饰性并设置 `aria-hidden` |
| `className` | 未设置 | `svg` 元素上的类名 |

`ctx.crewFaces.geometry(agentId, mood)`（也以 `faceGeometry` 导出）以数据形式返回同一头像（身体、颜色、眼睛颜色、身体部件、眼睛和眨眼偏移），供自行绘制或比较头像的调用方使用。

插件通过该服务共享组件而不是直接导入，因为客户端 bundle 不能导入其他插件的值。

-----

<a id="understand-the-implementation"></a>
## 实现原理

<details>
<summary>实现细节——点击展开</summary>

ID 的 32 位 FNV-1a 哈希以低位选择身体，以第 8 位起的位选择颜色，以第 16 位起的位选择眨眼偏移。

| 身体 | 部件 | 旋转 | 脸部圆 (cx, cy, r) |
|---|---|---|---|
| orb | 圆 (50,52) r38 | 无 | (50, 52, 38) |
| block | (27,27) 和 (73,27) 处 r11 的圆，(16,24) 处 68x62、rx16 的矩形 | 无 | (50, 56, 32) |
| drop | 路径 `M50 10C58 22 86 44 86 62A36 36 0 0 1 14 62C14 44 42 22 50 10Z` | 绕 (50,60) 旋转 -26° | (54, 58, 34) |
| bean | (24,12) 处 54x80、rx27 的矩形 | 绕 (51,52) 旋转 -16° | (52, 46, 30) |

脸部圆用于定位眼睛，从不绘制。眼睛 1 的中心位于 (cx+0.2r, cy-0.36r)，宽 0.29r、高 0.52r，旋转 -20°。眼睛 2 的中心位于 (cx+0.6r, cy-0.47r)，宽度为眼睛 1 的 0.8 倍、高度为其 0.76 倍，旋转 -22°。每只眼睛是 `rx` 等于其宽度一半的矩形。`working` 情绪使两个中心各向右、向上移动 0.06r。

身体颜色为 `#0B0B0C`、`#4D6BFE`、`#E8B4A0`、`#A8C7A1`、`#C9B6E4` 和 `#F2D16B`。它们用于识别智能体，因此不随主题变化。眼睛为 `#17181A`，在 `#0B0B0C` 身体上为白色。

眨眼是作用于两只眼睛的 CSS module 动画；每个头像根据 ID 设置 `--crew-blink-delay`。每只眼睛在 5 秒周期中短暂缩放到 10% 高度，相位按 ID 偏移。`prefers-reduced-motion: reduce` 会停止动画。

| 源文件 | 内容 |
|---|---|
| [`src/geometry.ts`](src/geometry.ts) | 哈希、身体、颜色和眼睛位置 |
| [`src/client/CrewFace.tsx`](src/client/CrewFace.tsx) | SVG 组件 |
| [`src/client/CrewFace.module.css`](src/client/CrewFace.module.css) | 眨眼 |
| [`src/client/index.ts`](src/client/index.ts) | `ctx.crewFaces` 服务 |
| [`tests/`](tests/) | 几何与标记测试 |

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [ui-primitives](../../client/ui-primitives/README.zh.md) — crew 页面与本头像组合使用的共享 React 基础组件。

<a id="model-experience"></a>
## 模型体验

无，本包是浏览器端头像组件，不注册任何面向模型的内容。

#### KV Cache 影响

无；本包既不组装也不发送模型提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 两个智能体可能共用同一头像：身体与颜色共有 24 种组合。
- 身体颜色不随浅色或深色主题变化，因此近黑色身体在深色背景上对比度较低。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景——点击展开</summary>

由于头像没有交互，标记测试在 Node 通道中使用 `react-dom/server` 渲染。

</details>
