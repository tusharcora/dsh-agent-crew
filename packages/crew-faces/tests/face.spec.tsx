import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { CrewFace } from '../src/client/CrewFace.tsx'
import { faceGeometry } from '../src/geometry.ts'

function count(markup: string, pattern: RegExp): number {
  return markup.match(pattern)?.length ?? 0
}

it('names the face for assistive technology when a label is given', () => {
  const markup = renderToStaticMarkup(<CrewFace agentId="agent-mail" label="Mail" />)
  expect(markup).toMatch(/^<svg viewBox="0 0 100 100"/)
  expect(markup).toContain('role="img"')
  expect(markup).toContain('aria-label="Mail"')
})

it('hides an unlabelled face from assistive technology', () => {
  const markup = renderToStaticMarkup(<CrewFace agentId="agent-mail" />)
  expect(markup).toContain('aria-hidden="true"')
  expect(markup).not.toContain('role="img"')
})

it('draws only the body parts and two eyes, with no background shape', () => {
  for (const id of ['agent-mail', 'agent-chat', 'agent-code', 'agent-research', 'agent-life', 'chief']) {
    const face = faceGeometry(id)
    const markup = renderToStaticMarkup(<CrewFace agentId={id} />)
    expect(count(markup, /<(circle|rect|path) /g)).toBe(face.shape.parts.length + 2)
    expect(count(markup, new RegExp(`fill="${face.color}"`, 'g'))).toBe(face.shape.parts.length)
    expect(count(markup, new RegExp(`fill="${face.eyeColor}"`, 'g'))).toBe(2)
  }
})

it('gives both eyes the blinking class and each face its own blink phase', () => {
  const markup = renderToStaticMarkup(<CrewFace agentId="agent-life" />)
  // Only the two eyes carry the blink class; body parts have none.
  expect(count(markup, /<rect class="[^"]+"/g)).toBe(2)
  expect(markup).toContain(`--crew-blink-delay:${-faceGeometry('agent-life').blinkDelayMs}ms`)
})

it('marks the working mood and moves the eyes', () => {
  const working = renderToStaticMarkup(<CrewFace agentId="agent-code" mood="working" />)
  expect(working).toContain('data-mood="working"')
  expect(working).not.toBe(renderToStaticMarkup(<CrewFace agentId="agent-code" />))
})
