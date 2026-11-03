import Link from 'next/link'
import { epley1RM } from '@/lib/lifts'
import { exerciseImageUrl } from '@/lib/exercise-catalogue'
import type { LiftHistory } from '@/lib/lift-history'
import LiftChart from '@/app/(app)/lifts/[slug]/LiftChart'
import LiftVideoSection from '@/app/(app)/lifts/[slug]/LiftVideoSection'

type Props = {
  history: LiftHistory
  /** Back button, share button, anything that sits in the corner of the header. */
  leading?: React.ReactNode
  trailing?: React.ReactNode
  /** Small label above the title, e.g. "Nate’s lift". */
  eyebrow?: string
  /** Where a session opens: the in-app summary or the public share page. */
  sessionHref: (workoutId: string) => string
  /** The "show more" link, given how many sessions to show. Omit to show everything. */
  moreHref?: (count: number) => string
  visibleCount: number
  perPage: number
}

/** One person's history for one lift. Used by the in-app page and by the public share page. */
export default function LiftHistoryView({ history, leading, trailing, eyebrow, sessionHref, moreHref, visibleCount, perPage }: Props) {
  const { title, catalogueExercise, sessions, chartData, videoClips, prWeight, prReps, prE1RM, setCount } = history
  const visible = sessions.slice(0, visibleCount)
  const hidden = sessions.length - visible.length
  const image = catalogueExercise ? exerciseImageUrl(catalogueExercise.images) : null

  return (
    <>
      <header className="mb-6 flex items-start gap-4">
        {leading}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-zinc-100 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-green-700">{eyebrow}</p>}
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
          {catalogueExercise && (
            <p className="mt-0.5 text-xs capitalize text-zinc-400">
              {[catalogueExercise.primary_muscles?.join(', '), catalogueExercise.equipment].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {trailing}
      </header>

      {setCount === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-400">No sets logged for this exercise yet.</p>
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-green-700/30 bg-green-50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-700">Best Set</p>
          <p className="text-2xl font-bold">{prWeight} lbs</p>
          <p className="text-xs text-zinc-400">
            {prReps} rep{prReps !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Est. 1RM</p>
          <p className="text-2xl font-bold">{prE1RM > 0 ? `${prE1RM} lbs` : '—'}</p>
          <p className="text-xs text-zinc-400">Epley formula</p>
        </div>
      </section>

      {chartData.length >= 2 && (
        <section className="mb-6 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Est. 1RM Progress · {chartData.length} sessions
          </p>
          <LiftChart data={chartData} />
        </section>
      )}

      <LiftVideoSection clips={videoClips} />

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Session History</h2>

        <div className="space-y-3">
          {visible.map((session) => (
            <div key={session.workoutId} className="overflow-hidden rounded-xl border border-zinc-100 bg-white shadow-sm">
              <Link href={sessionHref(session.workoutId)} className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50">
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(session.workoutDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {session.workoutName && <p className="text-xs text-zinc-500">{session.workoutName}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {session.bestE1RM !== null && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
                      e1RM {session.bestE1RM}
                    </span>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-600" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </Link>

              <div className="border-t border-zinc-100 px-4 pb-3 pt-2">
                <ul className="space-y-1">
                  {session.sets.map((set, i) => {
                    const isBest = set === session.bestSet
                    const e1rm = epley1RM(set.weight, set.reps)
                    return (
                      <li key={set.id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${isBest ? 'bg-green-50' : ''}`}>
                        <span className={`text-xs ${isBest ? 'text-green-700' : 'text-zinc-500'}`}>Set {i + 1}</span>
                        <span className="font-medium">
                          {set.weight} lbs × {set.reps}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {set.rpe !== null && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">RPE {set.rpe}</span>}
                          {e1rm !== null && isBest && <span className="text-xs text-zinc-500">e1RM {e1rm}</span>}
                          {set.video_url && <span className="h-1.5 w-1.5 rounded-full bg-green-600" title="Has video" />}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {hidden > 0 && moreHref && (
          <Link
            href={moreHref(visibleCount + perPage)}
            scroll={false}
            className="mt-4 block rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
          >
            Show {Math.min(perPage, hidden)} more · {hidden} older session{hidden !== 1 ? 's' : ''}
          </Link>
        )}
      </section>
    </>
  )
}
