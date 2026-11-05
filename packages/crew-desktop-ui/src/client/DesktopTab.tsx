/** Right-panel Desktop tab: the latest screen an agent saw, where computer use runs, and Pause, Take over and Resume. */
import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopState } from './desktop-model.ts'
import type {} from './index.ts'
import css from './DesktopTab.module.css'

/** What the tab reads and does. */
export interface DesktopTabInjected {
  hooks: { desktop: HostObservable<DesktopState> }
  readonly pause: () => Promise<boolean>
  readonly takeOver: () => Promise<boolean>
  readonly resume: () => void
}

type Props = InjectFace<DesktopTabInjected> & PropsLocale<'crewDesktop'>

function when(time: number): string {
  return new Date(time).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

/**
 * Render the Desktop tab. Nothing stops the agent without a click.
 * @param props - Desktop state, actions and copy.
 * @returns the tab body.
 */
export function DesktopTab({ useDesktop, pause, takeOver, resume, t }: Props) {
  const state = useDesktop(value => value)
  const [busy, setBusy] = useState(false)
  const run = (action: () => Promise<boolean>): void => {
    setBusy(true)
    void action().finally(() => { setBusy(false) })
  }
  const { frame, location } = state
  const where = state.locationFailed ? t('where.failed')
    : location === undefined ? t('where.loading')
      : location.provider === undefined ? t('where.none', { host: location.host })
        : t('where.provider', { provider: location.provider, host: location.host })
  return (
    <section className={css.tab} aria-label={t('tab.title')}>
      <p className={css.where}>{where}</p>
      {state.takenOver
        ? <p className={css.control} role="status">{t('status.takenOver')}</p>
        : <p className={css.status} role="status">{state.running ? t('status.running') : t('status.idle')}</p>}
      <div className={css.actions}>
        {state.takenOver
          ? <Button variant="primary" size="sm" aria-label={t('action.resumeLabel')} onClick={resume}>{t('action.resume')}</Button>
          : <>
            <Button variant="outline" size="sm" disabled={busy || !state.running} aria-label={t('action.pauseLabel')}
              onClick={() => { run(pause) }}>{t('action.pause')}</Button>
            <Button variant="outline" size="sm" disabled={busy} aria-label={t('action.takeOverLabel')}
              onClick={() => { run(takeOver) }}>{t('action.takeOver')}</Button>
          </>}
      </div>
      {state.stopFailed && <p className={css.error} role="alert">{t('action.failed')}</p>}
      {frame === undefined
        ? <p className={css.hint}>{t('frame.empty')}</p>
        : <figure className={css.screen}>
          {state.image !== undefined
            ? <img src={state.image} alt={t('frame.alt', { tool: frame.tool, time: when(frame.time) })}
              width={frame.attachment.width} height={frame.attachment.height} />
            : <p className={state.imageFailed ? css.error : css.hint}>{t(state.imageFailed ? 'frame.failed' : 'frame.loading')}</p>}
        </figure>}
      {frame !== undefined && <p className={css.caption}>{t('frame.caption', { tool: frame.tool, time: when(frame.time) })}</p>}
    </section>
  )
}
