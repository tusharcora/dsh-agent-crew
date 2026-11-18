/** A member's routines in its editor: the list, a delete button per routine and the form that adds one. */
import { useId, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { routineProblem, WEEKDAYS, type Routine, type RoutineDraft } from './routines.ts'
import css from './MemberEditor.module.css'

/** Props of {@link RoutinesSection}. */
export interface RoutinesSectionProps extends PropsLocale<'crew'> {
  readonly routines: readonly Routine[]
  /** Resolves undefined once added, or the message to show. */
  readonly add: (draft: RoutineDraft) => Promise<string | undefined>
  /** Resolves undefined once deleted, or the message to show. */
  readonly remove: (id: string) => Promise<string | undefined>
}

/** Locale key of an ISO weekday. */
const dayKey = (day: number) => `routine.day.${String(day)}` as `routine.day.${(typeof WEEKDAYS)[number]}`

const EMPTY: RoutineDraft = { title: '', prompt: '', days: [1, 2, 3, 4, 5], time: '08:00' }

/**
 * Render the member's routines and the add form.
 * @param props - the routines, add and delete actions, and copy.
 * @returns the section.
 */
export function RoutinesSection({ routines, add, remove, t }: RoutinesSectionProps) {
  const base = useId()
  const [draft, setDraft] = useState<RoutineDraft>(EMPTY)
  const [message, setMessage] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const days = (list: readonly number[]) => list.length === WEEKDAYS.length
    ? t('routine.everyDay')
    : list.map(day => t(dayKey(day))).join(', ')
  const run = async (action: () => Promise<string | undefined>, reset: boolean) => {
    setBusy(true)
    const failure = await action()
    setBusy(false)
    setMessage(failure)
    if (failure === undefined && reset) setDraft(EMPTY)
  }
  const onAdd = () => {
    const problem = routineProblem(draft)
    if (problem !== undefined) { setMessage(t(problem)); return }
    void run(() => add(draft), true)
  }
  return (
    <fieldset className={css.group} aria-describedby={`${base}-hint`}>
      <legend className={css.legend}>{t('routine.title')}</legend>
      <span id={`${base}-hint`} className={css.hint}>{t('routine.hint')}</span>
      {routines.length === 0
        ? <p className={css.hint}>{t('routine.none')}</p>
        : (
          <ul className={css.routines} aria-label={t('routine.title')}>
            {routines.map(routine => (
              <li key={routine.id} className={css.routine}>
                <span className={css.routineText}>
                  <strong>{routine.title}</strong>
                  <span className={css.hint}>{t('routine.when', { days: days(routine.days), time: routine.time })}
                    {routine.active ? '' : ` · ${t('routine.paused')}`}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={busy} aria-label={t('routine.deleteLabel', { title: routine.title })}
                  onClick={() => { void run(() => remove(routine.id), false) }}>{t('routine.delete')}</Button>
              </li>
            ))}
          </ul>
        )}
      <label className={css.field}>{t('routine.name')}
        <input className={css.input} value={draft.title} maxLength={120} placeholder={t('routine.namePlaceholder')}
          onChange={(event) => { setDraft({ ...draft, title: event.target.value }) }} />
      </label>
      <label className={css.field}>{t('routine.prompt')}
        <textarea className={css.textarea} rows={2} value={draft.prompt} placeholder={t('routine.promptPlaceholder')}
          onChange={(event) => { setDraft({ ...draft, prompt: event.target.value }) }} />
      </label>
      <div className={css.bodies} role="group" aria-label={t('routine.days')}>
        {WEEKDAYS.map(day => (
          <label key={day} className={css.check}>
            <input type="checkbox" checked={draft.days.includes(day)}
              onChange={(event) => {
                setDraft({ ...draft, days: event.target.checked ? [...draft.days, day] : draft.days.filter(value => value !== day) })
              }} />
            {t(dayKey(day))}
          </label>
        ))}
      </div>
      <label className={css.field}>{t('routine.time')}
        <input className={css.input} type="time" value={draft.time}
          onChange={(event) => { setDraft({ ...draft, time: event.target.value }) }} />
      </label>
      {message !== undefined && <p className={css.hint} role="status">{message}</p>}
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onAdd}>{t('routine.add')}</Button>
    </fieldset>
  )
}
