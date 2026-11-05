/** Provide crew faces to other browser plugins as a Cordis service. */
import type { ComponentType } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { faceGeometry, type CrewMood, type FaceDesign, type FaceGeometry } from '../geometry.ts'
import { CrewFace, type CrewFaceProps } from './CrewFace.tsx'

export { CrewFace, type CrewFaceProps } from './CrewFace.tsx'

/** Face drawing shared with other crew plugins. */
export interface CrewFaces {
  /** SVG face component. */
  readonly Face: ComponentType<CrewFaceProps>
  /**
   * The face as data.
   * @param agentId - stable agent id.
   * @param mood - current expression.
   * @param design - body and colour to use instead of the derived ones.
   * @returns body, colours, eyes and blink offset.
   */
  readonly geometry: (agentId: string, mood?: CrewMood, design?: FaceDesign) => FaceGeometry
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Crew agent faces. */
    crewFaces: CrewFaces
  }
}

/**
 * Provide `ctx.crewFaces`.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.reflect.provide('crewFaces', { Face: CrewFace, geometry: faceGeometry } satisfies CrewFaces)
}
