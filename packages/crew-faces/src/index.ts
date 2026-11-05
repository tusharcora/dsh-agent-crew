/** Crew agent face geometry; the SVG component is provided to browser plugins as `ctx.crewFaces`. */
export {
  CREW_BODIES, CREW_COLORS, FACE_CIRCLES, eyesFor, faceGeometry,
  type BodyPart, type BodyShape, type CrewBody, type CrewMood, type Eye, type FaceDesign, type FaceGeometry,
} from './geometry.ts'

/** Register the browser-only contribution without Host state. */
export function apply(): void {}
