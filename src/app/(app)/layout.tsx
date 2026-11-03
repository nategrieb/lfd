import { createServerSupabase } from '@/lib/supabase-server'
import BottomNav from '@/components/BottomNav'
import NavHistory from '@/components/NavHistory'
import { getAuthUser } from '@/lib/auth-user'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const user = await getAuthUser()

  let activeWorkoutId: string | null = null
  if (user?.id) {
    const { data } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    activeWorkoutId = data?.id ?? null
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <NavHistory />
      <BottomNav activeWorkoutId={activeWorkoutId} />
    </div>
  )
}
