/** Team task board: four columns, cards you drag or move from a detail panel, and a status line for each move. */
import { useState, type DragEvent } from 'react'
import { Button, IconCloseOutlineRegular, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TeamProjection, TeamTaskView } from '@deepseek-ai/dsh-agent-team/types'
import type { KanbanColumn } from '@deepseek-ai/dsh-crew-kanban/types'
import { COLUMNS, columnOf, targetsFrom } from './moves.ts'
import type {} from './index.ts'
import css from './KanbanBoard.module.css'

/**
 * Move one task; resolves undefined on success or the reason it was refused.
 * @param task - task as the board showed it.
 * @param from - its column.
 * @param to - target column.
 */
export type MoveTask = (task: TeamTaskView, from: KanbanColumn, to: KanbanColumn) => Promise<string | undefined>

/** Props of {@link KanbanBoard}. */
export interface KanbanBoardProps {
  /** The Lead Session's `agentTeam` projection, undefined while it loads or when Teams is unavailable. */
  readonly team: TeamProjection | undefined
  readonly move: MoveTask
  readonly t: TranslateNS<'crewKanban'>
}

const DRAG_TYPE = 'application/x-dsh-team-task'

interface CardProps {
  readonly task: TeamTaskView
  readonly column: KanbanColumn
  readonly onOpen: () => void
  readonly t: KanbanBoardProps['t']
}

function Card({ task, column, onOpen, t }: CardProps) {
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: task.id, column }))
    event.dataTransfer.effectAllowed = 'move'
  }
  return (
    <li className={css.card} draggable={targetsFrom(column).length > 0} onDragStart={onDragStart}>
      <button type="button" className={css.cardButton} onClick={onOpen} aria-label={t('card.open', { id: task.id, subject: task.subject })}>
        <span className={css.cardTop}>
          <span className={css.id}>#{task.id}</span>
          {task.writeScopeWarnings.length > 0 && (
            <span className={css.warn} title={t('warnings', { count: task.writeScopeWarnings.length })}>
              <IconWarningOutlineRegular size={12} />
            </span>
          )}
        </span>
        <span className={css.subject}>{task.subject}</span>
        <span className={css.meta}>{task.ownerName ?? (task.ownerId === undefined ? t('unowned') : task.ownerId)}</span>
        {task.blockedBy.length > 0 && column === 'blocked' && (
          <span className={css.meta}>{t('blockedBy', { ids: task.blockedBy.map(id => `#${id}`).join(', ') })}</span>
        )}
        {task.writeScopes.length > 0 && (
          <span className={css.chips}>
            {task.writeScopes.slice(0, 2).map(scope => <span key={scope} className={css.chip}>{scope}</span>)}
          </span>
        )}
      </button>
    </li>
  )
}

interface DetailProps {
  readonly task: TeamTaskView
  readonly column: KanbanColumn
  readonly busy: boolean
  readonly onMove: (to: KanbanColumn) => void
  readonly onClose: () => void
  readonly t: KanbanBoardProps['t']
}

function Detail({ task, column, onMove, onClose, busy, t }: DetailProps) {
  return (
    <aside className={css.detail} aria-label={t('card.open', { id: task.id, subject: task.subject })}>
      <div className={css.detailHead}>
        <span className={css.id}>#{task.id}</span>
        <h3 className={css.detailTitle}>{task.subject}</h3>
        <button type="button" className={css.close} onClick={onClose} aria-label={t('detail.close')}><IconCloseOutlineRegular size={14} /></button>
      </div>
      <dl className={css.facts}>
        <dt>{t('detail.status')}</dt><dd>{t(`column.${column}`)}</dd>
        <dt>{t('detail.owner')}</dt><dd>{task.ownerName ?? task.ownerId ?? t('unowned')}</dd>
        {task.blockedBy.length > 0 && <><dt>{t('detail.blockedBy')}</dt><dd>{task.blockedBy.map(id => `#${id}`).join(', ')}</dd></>}
        {task.writeScopes.length > 0 && <><dt>{t('detail.scopes')}</dt><dd>{task.writeScopes.join(', ')}</dd></>}
      </dl>
      {task.writeScopeWarnings.map(warning => <p key={warning} className={css.warning}>{warning}</p>)}
      <h4 className={css.label}>{t('detail.description')}</h4>
      <p className={css.description}>{task.description === '' ? t('detail.none') : task.description}</p>
      <div className={css.actions}>
        {targetsFrom(column).map(to => (
          <Button key={to} size="sm" variant={to === 'done' ? 'primary' : 'outline'} disabled={busy} onClick={() => { onMove(to) }}>
            {t('move.to', { column: t(`column.${to}`) })}
          </Button>
        ))}
      </div>
      <p className={css.revision}>{t('detail.revision', { revision: task.revision })}</p>
    </aside>
  )
}

/**
 * Render the board for one Team.
 * @param props - projection, move action and copy.
 * @returns the board, or a notice when Teams is off or empty.
 */
export function KanbanBoard({ team, move, t }: KanbanBoardProps) {
  const [openId, setOpenId] = useState<string | undefined>()
  const [over, setOver] = useState<KanbanColumn | undefined>()
  const [status, setStatus] = useState<{ readonly text: string; readonly failed: boolean } | undefined>()
  const [busy, setBusy] = useState(false)
  if (team === undefined || !team.enabled) return <p className={css.notice}>{t('off')}</p>
  const tasks = team.tasks.flatMap((task) => {
    const column = columnOf(task)
    return column === undefined ? [] : [{ task, column }]
  })
  const run = async (task: TeamTaskView, from: KanbanColumn, to: KanbanColumn) => {
    if (busy || !targetsFrom(from).includes(to)) return
    setBusy(true)
    const refusal = await move(task, from, to)
    setBusy(false)
    setStatus(refusal === undefined
      ? { text: t('moved', { id: task.id, column: t(`column.${to}`) }), failed: false }
      : { text: t('moveFailed', { id: task.id, message: refusal }), failed: true })
  }
  const onDrop = (to: KanbanColumn) => (event: DragEvent) => {
    event.preventDefault()
    setOver(undefined)
    let dragged: { id?: unknown; column?: unknown }
    try { dragged = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as typeof dragged } catch { return }
    const found = tasks.find(entry => entry.task.id === dragged.id && entry.column === dragged.column)
    if (found !== undefined) void run(found.task, found.column, to)
  }
  const opened = tasks.find(entry => entry.task.id === openId)
  return (
    <div className={css.root}>
      {team.failure !== undefined && <p className={css.error} role="alert">{t('failure', { message: team.failure })}</p>}
      {tasks.length === 0 ? <p className={css.notice}>{t('empty')}</p> : <p className={css.hint}>{t('move.hint')}</p>}
      <div className={css.board}>
        {COLUMNS.map((column) => {
          const cards = tasks.filter(entry => entry.column === column)
          return (
            <section key={column} className={css.column} data-over={over === column || undefined}
              aria-label={t('column.label', { column: t(`column.${column}`), count: cards.length })}
              onDragOver={(event) => { event.preventDefault(); setOver(column) }}
              onDragLeave={() => { setOver(undefined) }} onDrop={onDrop(column)}>
              <h3 className={css.columnHead} data-column={column}>
                {t(`column.${column}`)} <span className={css.count}>{cards.length}</span>
              </h3>
              <ul className={css.cards}>
                {cards.length === 0 && <li className={css.emptyColumn}>{t('empty.column')}</li>}
                {cards.map(({ task }) => <Card key={task.id} task={task} column={column} onOpen={() => { setOpenId(task.id) }} t={t} />)}
              </ul>
            </section>
          )
        })}
      </div>
      {opened !== undefined && (
        <Detail task={opened.task} column={opened.column} busy={busy} t={t}
          onMove={(to) => { void run(opened.task, opened.column, to) }} onClose={() => { setOpenId(undefined) }} />
      )}
      <p className={status?.failed === true ? css.error : css.status} role="status">{status?.text}</p>
    </div>
  )
}
