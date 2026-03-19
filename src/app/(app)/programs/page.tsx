import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'

export default async function ProgramsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { data: programs } = await supabase
    .from('program_templates')
    .select('id, name, description, duration_weeks')
    .order('name')

  // Fetch active enrollments for the user
  const { data: enrollments } = await supabase
    .from('program_enrollments')
    .select('template_id, status')
    .eq('user_id', user.id)
    .in('status', ['active'])

  const enrolledIds = new Set((enrollments ?? []).map((e) => e.template_id))

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6 flex items-center gap-4">
        <Link
          href="/history"
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Programs</h1>
          <p className="mt-0.5 text-sm text-zinc-400">Structured periodized training cycles</p>
        </div>
      </header>

      {(programs ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center">
          <p className="text-sm font-medium text-zinc-400">No programs available yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(programs ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/programs/${p.id}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-white shadow-sm px-5 py-4 transition hover:border-zinc-200"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{p.name}</p>
                    {enrolledIds.has(p.id) && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>Active</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{p.duration_weeks} weeks</p>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.description}</p>
                  )}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
