/** Right-panel Crew tab body: the roster, the learning list, then the connections. */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { CrewConnections, type CrewConnectionsInjected } from './CrewConnections.tsx'
import { CrewLearning, type CrewLearningInjected } from './CrewLearning.tsx'
import { CrewPanel, type CrewPanelInjected } from './CrewPanel.tsx'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** Everything the tab body receives. */
export type CrewTabInjected = CrewPanelInjected & CrewLearningInjected & CrewConnectionsInjected

/**
 * Stack the roster, the learning list and the connections in one scroll area.
 * @param props - roster and connection state, actions and copy.
 * @returns the tab body.
 */
export function CrewTab(props: InjectFace<CrewTabInjected> & PropsLocale<'crew'>) {
  return (
    <div className={css.panel}>
      <CrewPanel useMembers={props.useMembers} Face={props.Face} openChat={props.openChat} t={props.t} />
      <CrewLearning useLearning={props.useLearning} refreshLearning={props.refreshLearning} decide={props.decide} t={props.t} />
      <CrewConnections useConnections={props.useConnections} refresh={props.refresh} save={props.save} remove={props.remove}
        connectGoogle={props.connectGoogle} disconnectGoogle={props.disconnectGoogle} openUrl={props.openUrl} t={props.t} />
    </div>
  )
}
