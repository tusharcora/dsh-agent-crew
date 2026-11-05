---
description: "SVG faces for crew agents: one of four bodies, a colour and two blinking pill eyes, derived deterministically from the agent id."
kind: "package-reference"
---

# @deepseek-ai/dsh-experimental-crew-faces

English | [中文](README.zh.md)

## Summary

Crew surfaces show each agent as a small face. `CrewFace` draws it as SVG on a 100x100 viewBox: one of four bodies (orb, block, drop, bean) in one of six colours, with two pill eyes and a blink every few seconds. The agent id selects body, colour and blink phase, so an agent keeps its face across reloads and machines. The face has no background shape.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The [crew-agents](../crew-agents/README.md) bundle mounts this client plugin. It provides `ctx.crewFaces`; a browser plugin injects `crewFaces` and draws a face with its `Face` component:

```tsx
const { Face } = ctx.crewFaces

<Face agentId={agent.id} mood={agent.working ? 'working' : 'idle'} size={32} label={t('crew.face', { name: agent.name })} />
```

| Prop | Default | Meaning |
|---|---|---|
| `agentId` | required | Stable agent id; selects body, colour and blink phase |
| `mood` | `idle` | `working` moves both eyes up and right |
| `design` | unset | `{ body, color }` replacing the body and colour derived from the id; the id still sets the blink phase |
| `size` | `40` | Width and height in CSS pixels |
| `label` | unset | Localized accessible name; without it the face is decorative and `aria-hidden` |
| `className` | unset | Class on the `svg` element |

`ctx.crewFaces.geometry(agentId, mood)`, also exported as `faceGeometry`, returns the same face as data (body, colour, eye colour, body parts, eyes and blink offset) for callers that draw it themselves or compare faces.

Plugins share the component through the service rather than importing it, because client bundles may not import another plugin's values.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

A 32-bit FNV-1a hash of the id selects the body from its low bits, the colour from bits 8 and up, and the blink offset from bits 16 and up.

| Body | Parts | Rotation | Face circle (cx, cy, r) |
|---|---|---|---|
| orb | circle (50,52) r38 | none | (50, 52, 38) |
| block | circles r11 at (27,27) and (73,27), 68x62 rect at (16,24) rx16 | none | (50, 56, 32) |
| drop | path `M50 10C58 22 86 44 86 62A36 36 0 0 1 14 62C14 44 42 22 50 10Z` | -26° about (50,60) | (54, 58, 34) |
| bean | 54x80 rect at (24,12) rx27 | -16° about (51,52) | (52, 46, 30) |

The face circle positions the eyes and is never drawn. Eye 1 is centred at (cx+0.2r, cy-0.36r), 0.29r wide and 0.52r tall, rotated -20°. Eye 2 is centred at (cx+0.6r, cy-0.47r), 0.8 times eye 1's width and 0.76 times its height, rotated -22°. Each eye is a rect whose `rx` is half its width. The `working` mood moves both centres 0.06r right and 0.06r up.

Body colours are `#0B0B0C`, `#4D6BFE`, `#E8B4A0`, `#A8C7A1`, `#C9B6E4` and `#F2D16B`. They identify an agent, so they stay fixed across themes. Eyes are `#17181A`, or white on the `#0B0B0C` body.

The blink is a CSS-module animation on both eyes; each face sets `--crew-blink-delay` from its id. Each eye scales to 10% height for a moment of a 5-second cycle, phase-shifted per id. `prefers-reduced-motion: reduce` stops it.

| Source | Contents |
|---|---|
| [`src/geometry.ts`](src/geometry.ts) | Hash, bodies, colours and eye placement |
| [`src/client/CrewFace.tsx`](src/client/CrewFace.tsx) | SVG component |
| [`src/client/CrewFace.module.css`](src/client/CrewFace.module.css) | Blink |
| [`src/client/index.ts`](src/client/index.ts) | `ctx.crewFaces` service |
| [`tests/`](tests/) | Geometry and markup tests |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-primitives](../../client/ui-primitives/README.md) — the shared React atoms crew pages compose with this face.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side face component that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Two agents can share a face: there are 24 body and colour combinations.
- Body colours do not follow the light or dark theme, so a near-black body has low contrast on a dark surface.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The markup tests render with `react-dom/server` in the Node lane because the face has no interaction.

</details>
