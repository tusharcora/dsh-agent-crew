/** Learning list in the Crew tab: lessons crew members propose from your ratings and corrections, and the ones they follow. */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewLearning as MemberLearning } from '@deepseek-ai/dsh-experimental-crew-improve/types'
import { CREW_MEMBERS, type CrewMemberId } from '../roster.ts'
import type { LearningDecision, LearningState } from './learning.ts'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** What the list reads and does. */
export interface CrewLearningInjected {
  hooks: { learning: HostObservable<LearningState> }
  readonly refreshLearning: () => Promise<void>
  readonly decide: (decision: LearningDecision, id: string) => Promise<string | undefined>
}

type Props = InjectFace<CrewLearningInjected> & PropsLocale<'crew'>

/** Proposals arrive in the background after a rating, so the open list re-reads at this interval. */
const LEARNING_POLL_MS = 30000

function isMember(member: string): member is CrewMemberId {
  return (CREW_MEMBERS as readonly string[]).includes(member)
}

function when(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * Render proposals with Approve and Reject, then the approved lessons with Remove. Nothing changes without a click.
 * @param props - learning state, decisions and copy.
 * @returns the list.
 */
export function CrewLearning({ useLearning, refreshLearning, decide, t }: Props) {
  const state = useLearning(value => value)
  const [busy, setBusy] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | undefined>()
  useEffect(() => {
    void refreshLearning()
    const timer = setInterval(() => { void refreshLearning() }, LEARNING_POLL_MS)
    return () => { clearInterval(timer) }
  }, [refreshLearning])
  const name = (member: string): string => isMember(member) ? t(member) : member
  const act = (decision: LearningDecision, id: string): void => {
    setBusy(id)
    setNotice(undefined)
    void decide(decision, id).then((failure) => {
      if (failure !== undefined) setNotice(failure === 'failed' ? t('learn.failed') : failure)
    }).finally(() => { setBusy(undefined) })
  }
  const members: readonly MemberLearning[] = state.data?.members ?? []
  const proposals = members.flatMap(member => member.proposals)
  const lessons = members.flatMap(member => member.lessons)
  const lessonText = new Map(lessons.map(lesson => [lesson.id, lesson.text]))
  return (
    <section className={css.connections} aria-label={t('learn.title')}>
      <h3 className={css.subheading}>{t('learn.title')}</h3>
      <p className={css.hint}>{t('learn.intro')}</p>
      {state.unavailable && <p className={css.error} role="alert">{t('learn.unavailable')}</p>}
      {state.data?.lastError !== undefined && <p className={css.error}>{t('learn.lastError', { error: state.data.lastError })}</p>}
      {notice !== undefined && <p className={css.error} role="alert">{notice}</p>}

      <h4 className={css.subheading}>{t('learn.proposals')}</h4>
      {state.loaded && proposals.length === 0 && <p className={css.hint}>{t('learn.noProposals')}</p>}
      {proposals.map(proposal => (
        <article key={proposal.id} className={css.connection} aria-label={t('learn.proposalLabel', { name: name(proposal.member) })}>
          <header>
            <span className={css.connectionName}>{name(proposal.member)}</span>
            <span className={css.uses}>{t(proposal.trigger === 'feedback' ? 'learn.fromRating' : 'learn.fromChat', { time: when(proposal.proposedAt) })}</span>
          </header>
          <p>{proposal.text}</p>
          <p className={css.hint}>{t('learn.evidence', { quote: proposal.evidence })}</p>
          {proposal.replaces !== undefined && <p className={css.hint}>{t('learn.replaces', { lesson: lessonText.get(proposal.replaces) ?? '' })}</p>}
          <div className={css.actions}>
            <Button variant="primary" size="sm" disabled={busy !== undefined}
              aria-label={t('learn.approveLabel', { name: name(proposal.member) })}
              onClick={() => { act('approve', proposal.id) }}>{t('learn.approve')}</Button>
            <Button variant="outline" size="sm" disabled={busy !== undefined}
              aria-label={t('learn.rejectLabel', { name: name(proposal.member) })}
              onClick={() => { act('reject', proposal.id) }}>{t('learn.reject')}</Button>
          </div>
        </article>
      ))}

      <h4 className={css.subheading}>{t('learn.lessons')}</h4>
      {state.loaded && lessons.length === 0 && <p className={css.hint}>{t('learn.noLessons')}</p>}
      <ul className={css.simple}>
        {lessons.map(lesson => (
          <li key={lesson.id}>
            <span><span className={css.connectionName}>{name(lesson.member)}</span> {lesson.text}
              <span className={css.uses}> {t('learn.approvedAt', { time: when(lesson.approvedAt) })}</span></span>
            <Button variant="ghost" size="sm" disabled={busy !== undefined}
              aria-label={t('learn.forgetLabel', { name: name(lesson.member), lesson: lesson.text })}
              onClick={() => { act('forget', lesson.id) }}>{t('learn.forget')}</Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
