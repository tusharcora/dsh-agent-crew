/** The Errands page: start an errand from one sentence, then follow, pause, resume or stop each one. */
import { useId, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { DEFAULT_ERRAND_ROUNDS, MAX_ERRAND_ROUNDS, type Errand } from './errands.ts'
import type {} from './index.ts'
import css from './ErrandsPage.module.css'

/** What the page receives. */
export interface ErrandsPageInjected {
  hooks: {
    errands: HostObservable<readonly Errand[]>
    /** False on a dsh without the goal service, where errands cannot run. */
    available: HostObservable<boolean>
  }
  /** Start an errand; resolves undefined once it runs, or the message to show. */
  start: (objective: string, rounds: number) => Promise<string | undefined>
  open: (sessionId: SessionId) => void
  /** Pause, resume or stop one errand; resolves undefined when done, or the message to show. */
  act: (errand: Errand, action: 'pause' | 'resume' | 'stop') => Promise<string | undefined>
}

/**
 * Render the page.
 * @param props - errands, actions and the `crew` translator.
 * @returns the page.
 */
export function ErrandsPage({ useErrands, useAvailable, start, open, act, t }: InjectFace<ErrandsPageInjected> & PropsLocale<'crew'>) {
  const errands = useErrands(value => value)
  const available = useAvailable(value => value)
  const base = useId()
  const [objective, setObjective] = useState('')
  const [rounds, setRounds] = useState(DEFAULT_ERRAND_ROUNDS)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | undefined>()
  const run = async (action: () => Promise<string | undefined>, clear: boolean) => {
    setBusy(true)
    const failure = await action()
    setBusy(false)
    setMessage(failure)
    if (failure === undefined && clear) setObjective('')
  }
  const waiting = errands.filter(errand => errand.state === 'needs-you' || errand.state === 'blocked').length
  const running = errands.filter(errand => errand.state === 'running').length
  return (
    <main className={css.page}>
      <div className={css.column}>
        <header className={css.hero}>
          <p className={css.eyebrow}>{t('errand.eyebrow')}</p>
          <h1 className={css.title}>{t('errand.title')}</h1>
          <p className={css.summary}>{t('errand.summary', { running: String(running), waiting: String(waiting) })}</p>
        </header>
        {!available
          ? <p className={css.notice} role="status">{t('errand.unavailable')}</p>
          : (
            <form className={css.start} aria-label={t('errand.new')}
              onSubmit={(event) => { event.preventDefault(); void run(() => start(objective, rounds), true) }}>
              <label className={css.field}>{t('errand.goal')}
                <textarea className={css.textarea} rows={3} value={objective} placeholder={t('errand.goalPlaceholder')} aria-describedby={`${base}-hint`}
                  onChange={(event) => { setObjective(event.target.value) }} />
              </label>
              <span id={`${base}-hint`} className={css.hint}>{t('errand.goalHint')}</span>
              <div className={css.row}>
                <label className={css.inline}>{t('errand.rounds')}
                  <input className={css.number} type="number" min={1} max={MAX_ERRAND_ROUNDS} step={1} value={rounds}
                    onChange={(event) => { setRounds(Math.trunc(Number(event.target.value) || DEFAULT_ERRAND_ROUNDS)) }} />
                </label>
                <span className={css.grow} />
                <Button type="submit" variant="primary" size="sm" disabled={busy}>{t('errand.start')}</Button>
              </div>
              {message !== undefined && <p className={css.notice} role="status">{message}</p>}
            </form>
          )}
        <section aria-label={t('errand.list')} className={css.list}>
          {errands.length === 0 && <p className={css.hint}>{t('errand.none')}</p>}
          {errands.map(errand => (
            <article key={errand.sessionId} className={css.card} data-state={errand.state}>
              <div className={css.cardHead}>
                <span className={css.chip} data-state={errand.state}>{t(`errand.state.${errand.state}`)}</span>
                {errand.maxRounds > 0 && <span className={css.hint}>{t('errand.roundsUsed', {
                  used: String(errand.roundsStarted), max: String(errand.maxRounds),
                })}</span>}
              </div>
              <p className={css.objective}>{errand.objective}</p>
              {errand.blockedReason !== undefined && <p className={css.reason}>{errand.blockedReason}</p>}
              <div className={css.row}>
                <Button type="button" variant="outline" size="sm" onClick={() => { open(errand.sessionId) }}>{t('errand.open')}</Button>
                {errand.state === 'running' || errand.state === 'needs-you'
                  ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { void run(() => act(errand, 'pause'), false) }}>
                    {t('errand.pause')}</Button>
                  : null}
                {errand.state === 'paused' || errand.state === 'blocked' || errand.state === 'running'
                  ? <Button type="button" variant="ghost" size="sm" disabled={busy}
                    aria-label={errand.state === 'running' ? t('errand.nudgeLabel') : undefined}
                    onClick={() => { void run(() => act(errand, 'resume'), false) }}>
                    {errand.state === 'running' ? t('errand.nudge') : t('errand.resume')}</Button>
                  : null}
                {errand.goal !== undefined && errand.state !== 'done'
                  ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { void run(() => act(errand, 'stop'), false) }}>
                    {t('errand.stop')}</Button>
                  : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
