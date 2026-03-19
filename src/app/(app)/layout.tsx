import { createServerSupabase } from '@/lib/supabase-server'
import BottomNav from '@/components/BottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav activeWorkoutId={activeWorkoutId} />
    </div>
  )
}
