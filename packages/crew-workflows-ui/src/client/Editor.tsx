/** Workflow editor: name, folder and steps, with Save, Run and Delete. */
import { useId, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { AgentStep, ToolStep, WorkflowDefinition, WorkflowStep } from '@deepseek-ai/dsh-crew-workflows/types'
import type { Member } from './RunView.tsx'
import type {} from './index.ts'
import css from './WorkflowsPage.module.css'

/** Props of {@link Editor}. */
export interface EditorProps {
  readonly initial: WorkflowDefinition
  readonly members: readonly Member[]
  /** Save; resolves the saved definition, or the reason it was refused. */
  readonly save: (definition: WorkflowDefinition) => Promise<{ readonly saved: WorkflowDefinition } | { readonly message: string }>
  readonly run: (id: string) => Promise<string | undefined>
  readonly remove: (id: string) => Promise<void>
  readonly t: TranslateNS<'crewWorkflows'>
}

let next = 0
function stepId(): string {
  next += 1
  return `step-${String(Date.now())}-${String(next)}`
}

/** Tool-step input as the user typed it, kept separately so a half-typed JSON object stays editable. */
type InputDrafts = Readonly<Record<string, string>>

/**
 * Parse a tool step's typed input.
 * @param text - JSON the user typed.
 * @returns the object, or undefined when it is not a JSON object.
 */
export function parseInput(text: string): ToolStep['input'] | undefined {
  try {
    const value: unknown = JSON.parse(text === '' ? '{}' : text)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as ToolStep['input'] : undefined
  } catch {
    return undefined
  }
}

/**
 * Edit one workflow.
 * @param props - the definition, crew members, actions and copy.
 * @returns the editor.
 */
export function Editor({ initial, members, save, run, remove, t }: EditorProps) {
  const [draft, setDraft] = useState(initial)
  const [inputs, setInputs] = useState<InputDrafts>(() => Object.fromEntries(initial.steps.flatMap(step => step.kind === 'tool' ? [[step.id, JSON.stringify(step.input, null, 2)]] : [])))
  const [status, setStatus] = useState<{ readonly text: string; readonly bad: boolean } | undefined>()
  const [dirty, setDirty] = useState(initial.id === '' || initial.draft === true)
  const [confirming, setConfirming] = useState(false)
  const base = useId()
  const edit = (patch: Partial<WorkflowDefinition>) => { setDraft({ ...draft, ...patch }); setDirty(true) }
  const editStep = (index: number, patch: Partial<AgentStep> | Partial<ToolStep>) => {
    edit({ steps: draft.steps.map((step, at) => at === index ? { ...step, ...patch } as WorkflowStep : step) })
  }
  const move = (index: number, by: -1 | 1) => {
    const steps = [...draft.steps]
    const [step] = steps.splice(index, 1)
    if (step === undefined) return
    steps.splice(index + by, 0, step)
    edit({ steps })
  }
  const addAgent = () => {
    edit({ steps: [...draft.steps, { id: stepId(), kind: 'agent', preset: members[0]?.id ?? 'crew-chief', task: '', prompt: '' }] })
  }
  const addTool = () => {
    const id = stepId()
    setInputs({ ...inputs, [id]: '{}' })
    edit({ steps: [...draft.steps, { id, kind: 'tool', tool: '', input: {} }] })
  }
  const badInput = draft.steps.some(step => step.kind === 'tool' && parseInput(inputs[step.id] ?? '{}') === undefined)
  const onSave = async () => {
    const steps = draft.steps.map(step => step.kind === 'tool' ? { ...step, input: parseInput(inputs[step.id] ?? '{}') ?? {} } : step)
    const result = await save({ ...draft, steps })
    if ('message' in result) { setStatus({ text: result.message, bad: true }); return }
    setDraft(result.saved)
    setDirty(false)
    setStatus({ text: t('saved'), bad: false })
  }
  const onRun = async () => {
    const refusal = await run(draft.id)
    setStatus(refusal === undefined ? undefined : { text: refusal, bad: true })
  }
  return (
    <form className={css.editor} aria-label={draft.name === '' ? t(draft.kind === 'agentic' ? 'new.agentic' : 'new.fixed') : draft.name}
      onSubmit={(event) => { event.preventDefault(); void onSave() }}>
      <div className={css.row}>
        <span className={css.kind}>{t(`kind.${draft.kind}`)}</span>
        {draft.draft === true && <span className={css.draftMark}>{t('draft')}</span>}
      </div>
      <label className={css.field}>{t('field.name')}
        <input className={css.input} value={draft.name} onChange={(event) => { edit({ name: event.target.value }) }} required />
      </label>
      <label className={css.field}>{t('field.description')}
        <input className={css.input} value={draft.description} onChange={(event) => { edit({ description: event.target.value }) }} />
      </label>
      <label className={css.field}>{t('field.cwd')}
        <input className={css.input} value={draft.cwd ?? ''} aria-describedby={`${base}-cwd`}
          onChange={(event) => {
            const { cwd: _cwd, ...rest } = draft
            setDraft(event.target.value === '' ? rest : { ...rest, cwd: event.target.value })
            setDirty(true)
          }} />
        <span id={`${base}-cwd`} className={css.muted}>{t('field.cwdHint')}</span>
      </label>
      <ol className={css.steps}>
        {draft.steps.map((step, index) => (
          <li key={step.id} className={css.step}>
            <div className={css.row}>
              <span className={css.stepLabel}>{t('step.label', { index: index + 1 })} · {t(step.kind === 'agent' ? 'step.agent' : 'step.tool')}</span>
              <span className={css.grow} />
              <Button size="sm" variant="ghost" type="button" disabled={index === 0} aria-label={t('step.up', { index: index + 1 })} onClick={() => { move(index, -1) }}>↑</Button>
              <Button size="sm" variant="ghost" type="button" disabled={index === draft.steps.length - 1} aria-label={t('step.down', { index: index + 1 })} onClick={() => { move(index, 1) }}>↓</Button>
              <Button size="sm" variant="ghost" type="button" aria-label={t('step.remove', { index: index + 1 })}
                onClick={() => { edit({ steps: draft.steps.filter(entry => entry.id !== step.id) }) }}>×</Button>
            </div>
            {index > 0 && (
              <label className={css.check}>
                <input type="checkbox" checked={step.together === true}
                  onChange={(event) => { editStep(index, { together: event.target.checked }) }} />
                {t('step.together')}
              </label>
            )}
            {step.kind === 'agent'
              ? (
                <>
                  <label className={css.field}>{t('step.member')}
                    <select className={css.input} value={step.preset}
                      onChange={(event) => { editStep(index, { preset: event.target.value }) }}>
                      {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                  <label className={css.field}>{t('step.task')}
                    <input className={css.input} value={step.task}
                      onChange={(event) => { editStep(index, { task: event.target.value }) }} />
                  </label>
                  <label className={css.field}>{t('step.prompt')}
                    <textarea className={css.textarea} rows={3} value={step.prompt}
                      onChange={(event) => { editStep(index, { prompt: event.target.value }) }} />
                  </label>
                </>
              )
              : (
                <>
                  <label className={css.field}>{t('step.toolName')}
                    <input className={css.input} value={step.tool}
                      onChange={(event) => { editStep(index, { tool: event.target.value }) }} />
                  </label>
                  <label className={css.field}>{t('step.input')}
                    <textarea className={css.textarea} rows={3} value={inputs[step.id] ?? '{}'} spellCheck={false}
                      aria-invalid={parseInput(inputs[step.id] ?? '{}') === undefined}
                      onChange={(event) => { setInputs({ ...inputs, [step.id]: event.target.value }); setDirty(true) }} />
                  </label>
                  {parseInput(inputs[step.id] ?? '{}') === undefined && <p className={css.bad}>{t('step.badInput')}</p>}
                </>
              )}
          </li>
        ))}
      </ol>
      <div className={css.row}>
        {draft.kind === 'agentic' && <Button size="sm" variant="outline" type="button" onClick={addAgent}>{t('add.agent')}</Button>}
        <Button size="sm" variant="outline" type="button" onClick={addTool}>{t('add.tool')}</Button>
      </div>
      <div className={css.row}>
        <Button size="sm" variant="primary" type="submit" disabled={badInput}>{t('save')}</Button>
        <Button size="sm" variant="outline" type="button" disabled={dirty || draft.id === ''} onClick={() => { void onRun() }}>{t('run')}</Button>
        <span className={css.grow} />
        {draft.id !== '' && !confirming && <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(true) }}>{t('delete')}</Button>}
      </div>
      {confirming && (
        <div className={css.confirm} role="alertdialog" aria-label={t('deleteAsk', { name: draft.name })}>
          <span>{t('deleteAsk', { name: draft.name })}</span>
          <Button size="sm" variant="primary" type="button" onClick={() => { void remove(draft.id) }}>{t('deleteConfirm')}</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => { setConfirming(false) }}>{t('cancelDelete')}</Button>
        </div>
      )}
      <p className={status?.bad === true ? css.bad : css.muted} role="status">{status?.text}</p>
    </form>
  )
}
