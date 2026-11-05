/** Right-panel Desktop tab: the latest screen an agent saw, where computer use runs, and Pause, Take over and Resume. */
import { useState } from 'react'
import { Button, IconPauseOutlineRegular, IconPlayOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
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

function Monitor() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className={css.whereIcon}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 14h5M8 11.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
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
  const mode = state.takenOver ? 'taken' : state.running ? 'working' : 'idle'
  return (
    <section className={css.tab} aria-label={t('tab.title')}>
      <header className={css.head}>
        <div className={css.headText}>
          <h2 className={css.title}>{t('tab.title')}</h2>
          {!state.takenOver && <p className={css.status} role="status">{state.running ? t('status.running') : t('status.idle')}</p>}
        </div>
        <span className={css.pill} data-mode={mode} aria-hidden="true">{t(`pill.${mode}`)}</span>
      </header>
      <p className={css.where} data-off={state.locationFailed || location?.provider === undefined || undefined}><Monitor />{where}</p>
      {state.takenOver && <p className={css.banner} role="status">{t('status.takenOver')}</p>}
      {state.stopFailed && <p className={css.error} role="alert">{t('action.failed')}</p>}
      <figure className={css.screen} data-mode={mode}>
        {frame === undefined
          ? <p className={css.empty}><Monitor />{t('frame.empty')}</p>
          : state.image !== undefined
            ? <>
              <img src={state.image} alt={t('frame.alt', { tool: frame.tool, time: when(frame.time) })}
                width={frame.attachment.width} height={frame.attachment.height} />
              <figcaption className={css.badge} aria-hidden="true">{frame.tool} · {when(frame.time)}</figcaption>
            </>
            : <p className={state.imageFailed ? css.error : css.empty}>{t(state.imageFailed ? 'frame.failed' : 'frame.loading')}</p>}
      </figure>
      {frame !== undefined && <p className={css.caption}>{t('frame.note')}</p>}
      <div className={css.actions}>
        {state.takenOver
          ? <Button variant="primary" className={css.wide} icon={<IconPlayOutlineRegular size={14} />}
            aria-label={t('action.resumeLabel')} onClick={resume}>{t('action.resume')}</Button>
          : <>
            <Button variant="outline" icon={<IconPauseOutlineRegular size={14} />} disabled={busy || !state.running}
              aria-label={t('action.pauseLabel')} onClick={() => { run(pause) }}>{t('action.pause')}</Button>
            <Button variant="primary" disabled={busy} aria-label={t('action.takeOverLabel')}
              onClick={() => { run(takeOver) }}>{t('action.takeOver')}</Button>
          </>}
      </div>
      <p className={css.hint}>{t(state.takenOver ? 'hint.resume' : 'hint.stop')}</p>
    </section>
  )
}
