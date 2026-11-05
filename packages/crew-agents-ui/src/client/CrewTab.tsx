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
      <CrewPanel useMembers={props.useMembers} useRoster={props.useRoster} useEditRequest={props.useEditRequest}
        clearEditRequest={props.clearEditRequest} Face={props.Face} openChat={props.openChat}
        saveMember={props.saveMember} removeMember={props.removeMember} t={props.t} />
      <CrewLearning useLearning={props.useLearning} refreshLearning={props.refreshLearning} decide={props.decide}
        nameOf={props.nameOf} t={props.t} />
      <CrewConnections useConnections={props.useConnections} refresh={props.refresh} save={props.save} remove={props.remove}
        connectGoogle={props.connectGoogle} disconnectGoogle={props.disconnectGoogle} openUrl={props.openUrl} t={props.t} />
    </div>
  )
}
