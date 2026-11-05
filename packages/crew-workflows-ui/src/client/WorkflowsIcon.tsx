/** Decorative glyph for the Workflows sidebar entry; the sidebar owns the accessible label. */
import { IconWorkspaceTreeOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * @param props - the sidebar's icon share.
 * @returns the tree glyph.
 */
export function WorkflowsIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <IconWorkspaceTreeOutlineRegular size={size} />
}
