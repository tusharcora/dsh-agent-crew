/** Decorative glyph for the Today sidebar entry; the sidebar owns the accessible label. */
import { IconLightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * @param props - the sidebar's icon share.
 * @returns the sun glyph.
 */
export function TodayIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconLightOutlineRegular size={size} />
}
