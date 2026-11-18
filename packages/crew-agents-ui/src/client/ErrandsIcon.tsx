/** Decorative glyph for the Errands sidebar entry; the sidebar owns the accessible label. */
import { IconGoalOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * @param props - the sidebar's icon share.
 * @returns the goal glyph.
 */
export function ErrandsIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconGoalOutlineRegular size={size} />
}
