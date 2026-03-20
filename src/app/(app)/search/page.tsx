import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import FollowButton from '../people/FollowButton'

type SearchParams = Promise<{ q?: string; tab?: string }>

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) redirect('/login')

  const { q: rawQ, tab: rawTab } = await searchParams
  const q = (rawQ ?? '').trim().slice(0, 50)
  const tab = rawTab === 'programs' ? 'programs' : 'people'

  type PersonProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
  type Program = { id: string; name: string; description: string | null; duration_weeks: number | null }

  // Who the current user is following
  const { data: followingData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
  const followingIds = new Set((followingData ?? []).map((f) => f.following_id))

  // Enrolled programs
  const { data: enrollmentData } = await supabase
    .from('program_enrollments')
    .select('template_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
  const enrolledIds = new Set((enrollmentData ?? []).map((e) => e.template_id))

  // Search results
  let peopleResults: PersonProfile[] = []
  let programResults: Program[] = []

  if (q.length >= 2) {
    if (tab === 'people') {
      const [{ data: byUsername }, { data: byName }] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, avatar_url').ilike('username', `%${q}%`).neq('id', user.id).limit(20),
        supabase.from('profiles').select('id, username, display_name, avatar_url').ilike('display_name', `%${q}%`).neq('id', user.id).limit(20),
      ])
      const seen = new Set<string>()
      for (const row of [...(byUsername ?? []), ...(byName ?? [])]) {
        if (!seen.has(row.id)) { seen.add(row.id); peopleResults.push(row as PersonProfile) }
      }
    } else {
      const { data } = await supabase
        .from('program_templates')
        .select('id, name, description, duration_weeks')
        .ilike('name', `%${q}%`)
        .order('name')
        .limit(20)
      programResults = (data ?? []) as Program[]
    }
  }

  // Default people list: who the user follows
  let followingProfiles: PersonProfile[] = []
  if (q.length < 2 && followingIds.size > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', [...followingIds])
    followingProfiles = (data ?? []) as PersonProfile[]
  }

  // Default program list: all programs
  let allPrograms: Program[] = []
  if (q.length < 2 || tab === 'programs') {
    const { data } = await supabase
      .from('program_templates')
      .select('id, name, description, duration_weeks')
      .order('name')
    allPrograms = (data ?? []) as Program[]
  }

  const hasQuery = q.length >= 2

  return (
    <div className="mx-auto max-w-lg px-5 py-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">Search</h1>
        <p className="mt-1 text-sm text-zinc-500">Find friends and training programs.</p>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 flex rounded-xl bg-zinc-100 p-1">
        <Link
          href={`/search?tab=people${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            tab === 'people' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          People
        </Link>
        <Link
          href={`/search?tab=programs${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            tab === 'programs' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Programs
        </Link>
      </div>

      {/* Search bar */}
      <form method="GET" className="mb-6">
        <input type="hidden" name="tab" value={tab} />
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={tab === 'people' ? 'Search by username…' : 'Search programs…'}
            autoComplete="off"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-green-700 focus:ring-1 focus:ring-green-700"
          />
        </div>
      </form>

      {/* ── People tab ─────────────────────────────────────────────── */}
      {tab === 'people' && (
        <section>
          {hasQuery ? (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Results for &ldquo;{q}&rdquo;
              </p>
              {peopleResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center">
                  <p className="text-sm text-zinc-400">No users found.</p>
                </div>
              ) : (
                <PersonList profiles={peopleResults} followingIds={followingIds} />
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Following{followingProfiles.length > 0 ? ` · ${followingProfiles.length}` : ''}
              </p>
              {followingProfiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center">
                  <p className="text-sm text-zinc-400">You&apos;re not following anyone yet.</p>
                  <p className="mt-1 text-xs text-zinc-300">Search for a username above to find friends.</p>
                </div>
              ) : (
                <PersonList profiles={followingProfiles} followingIds={followingIds} />
              )}
            </>
          )}
        </section>
      )}

      {/* ── Programs tab ───────────────────────────────────────────── */}
      {tab === 'programs' && (
        <section>
          {hasQuery ? (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Results for &ldquo;{q}&rdquo;
              </p>
              {programResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center">
                  <p className="text-sm text-zinc-400">No programs found.</p>
                </div>
              ) : (
                <ProgramList programs={programResults} enrolledIds={enrolledIds} />
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">All Programs</p>
              <ProgramList programs={allPrograms} enrolledIds={enrolledIds} />
            </>
          )}
        </section>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

type PersonProfile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }

function PersonList({ profiles, followingIds }: { profiles: PersonProfile[]; followingIds: Set<string> }) {
  return (
    <ul className="space-y-2">
      {profiles.map((p) => {
        const name = p.display_name || p.username || 'User'
        const initial = (name[0] ?? '?').toUpperCase()
        const href = p.username ? `/people/${p.username}` : null
        const avatar = (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}
          >
            {p.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={p.avatar_url} alt={name} className="h-full w-full object-cover" />
              : initial}
          </div>
        )
        return (
          <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 shadow-sm">
            {href
              ? <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                  {avatar}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
                    {p.username && <p className="text-xs text-zinc-500">@{p.username}</p>}
                  </div>
                </Link>
              : <div className="flex min-w-0 flex-1 items-center gap-3">
                  {avatar}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
                  </div>
                </div>
            }
            <FollowButton userId={p.id} initialIsFollowing={followingIds.has(p.id)} />
          </li>
        )
      })}
    </ul>
  )
}

type Program = { id: string; name: string; description: string | null; duration_weeks: number | null }

function ProgramList({ programs, enrolledIds }: { programs: Program[]; enrolledIds: Set<string> }) {
  if (programs.length === 0) return (
    <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center">
      <p className="text-sm text-zinc-400">No programs available.</p>
    </div>
  )
  return (
    <ul className="space-y-2">
      {programs.map((p) => (
        <li key={p.id}>
          <Link
            href={`/programs/${p.id}`}
            className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-4 py-3.5 shadow-sm transition hover:border-zinc-200"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-zinc-900">{p.name}</p>
                {enrolledIds.has(p.id) && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #166534, #16a34a)' }}>
                    Active
                  </span>
                )}
              </div>
              {p.description && <p className="mt-0.5 truncate text-xs text-zinc-500">{p.description}</p>}
              {p.duration_weeks && <p className="mt-0.5 text-xs text-zinc-400">{p.duration_weeks} weeks</p>}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  )
}
