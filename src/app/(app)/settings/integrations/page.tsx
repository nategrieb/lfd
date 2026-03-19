import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import StrongImporter from './StrongImporter'

export default async function IntegrationsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) redirect('/login')

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-zinc-400">Import workout history from other apps.</p>
      </header>

      {/* File Imports section */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-semibold">File Imports</h2>

        <div className="mt-5 border-t border-zinc-800 pt-5">
          <div className="mb-4 flex items-center gap-3">
            {/* Strong App logo placeholder */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-xs font-bold tracking-tight text-amber-400">
              S
            </div>
            <div>
              <p className="font-semibold">Strong App</p>
              <p className="text-xs text-zinc-400">
                Export from Strong → Settings → Export Workouts (CSV)
              </p>
            </div>
          </div>

          <StrongImporter />
        </div>
      </section>

      {/* Migration notice */}
      <p className="mt-4 text-center text-xs text-zinc-600">
        First-time setup? Run the SQL migration in{' '}
        <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-400">
          supabase/migrations/20260319000000_strong_import.sql
        </code>{' '}
        before importing.
      </p>
    </div>
  )
}
