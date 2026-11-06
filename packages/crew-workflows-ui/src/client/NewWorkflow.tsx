/** The New workflow screen: name, type, description and folder, then Create opens the builder with them filled in. */
import { useId, useState } from 'react'
import { Button, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDefinition, WorkflowKind } from '@deepseek-ai/dsh-crew-workflows/types'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** Props of {@link NewWorkflow}. */
export interface NewWorkflowProps {
  /** Open the builder on this unsaved definition. */
  readonly onCreate: (definition: WorkflowDefinition) => void
  readonly onCancel: () => void
  readonly t: TranslateNS<'crewWorkflows'>
}

const KINDS: readonly WorkflowKind[] = ['agentic', 'fixed']

/**
 * Render the New workflow form.
 * @param props - create and cancel actions, and copy.
 * @returns the form.
 */
export function NewWorkflow({ onCreate, onCancel, t }: NewWorkflowProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cwd, setCwd] = useState('')
  const [kind, setKind] = useState<WorkflowKind>('agentic')
  const base = useId()
  return (
    <form className={css.newForm} aria-label={t('new')}
      onSubmit={(event) => {
        event.preventDefault()
        onCreate({ id: '', name: name.trim(), description: description.trim(), kind, steps: [], updatedAt: '', ...cwd.trim() === '' ? {} : { cwd: cwd.trim() } })
      }}>
      <div className={css.topBar}>
        <nav className={css.crumbs} aria-label={t('breadcrumb')}>
          <button type="button" className={css.crumbLink} onClick={onCancel}>{t('title')}</button>
          <IconChevronRightOutlineRegular size={12} />
          <span className={css.crumbHere}>{t('new')}</span>
        </nav>
        <span className={css.grow} />
        <Button size="sm" variant="ghost" type="button" onClick={onCancel}>{t('cancel')}</Button>
        <Button size="sm" variant="primary" type="submit" disabled={name.trim() === ''}>{t('create')}</Button>
      </div>

      <header className={css.pageHead}>
        <h1 className={css.title}>{t('new')}</h1>
        <p className={css.lede}>{t('new.lede')}</p>
      </header>

      <div className={css.formCard}>
        <label className={css.field}>{t('field.name')}
          <input className={css.input} value={name} placeholder={t('field.namePlaceholder')} required
            onChange={(event) => { setName(event.target.value) }} />
        </label>

        <fieldset className={css.kindSet}>
          <legend className={css.field}>{t('new.type')}</legend>
          <div className={css.kindOptions}>
            {KINDS.map(option => (
              <label key={option} className={css.kindOption} data-kind={option} data-on={kind === option || undefined}>
                <input type="radio" name={`${base}-kind`} value={option} checked={kind === option}
                  onChange={() => { setKind(option) }} />
                <span className={css.kindHead}>
                  <span className={css.tile} data-kind={option} aria-hidden="true">{t(`kind.${option}`).slice(0, 1)}</span>
                  <span className={css.kindName}>{t(`kind.${option}`)}</span>
                  <span className={css.radioMark} aria-hidden="true" />
                </span>
                <span className={css.muted}>{t(`start.${option}`)}</span>
                <span className={css.kindFacts}>{t(`new.${option}Facts`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={css.field}>{t('field.description')}
          <textarea className={`${css.textarea} ${css.prose}`} rows={3} value={description} placeholder={t('new.descriptionPlaceholder')}
            onChange={(event) => { setDescription(event.target.value) }} />
        </label>

        <label className={css.field}>{t('field.cwd')}
          <input className={css.input} value={cwd} placeholder={t('field.cwdHint')} aria-describedby={`${base}-cwd`}
            onChange={(event) => { setCwd(event.target.value) }} />
          <span id={`${base}-cwd`} className={css.muted}>{t('new.cwdNote')}</span>
        </label>
      </div>
    </form>
  )
}
