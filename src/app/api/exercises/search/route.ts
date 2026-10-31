import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { COMMON_LIFTS, exerciseImageUrl, type CatalogueExercise } from '@/lib/exercise-catalogue'

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ exercises: [] })

  // Every word must appear in the name, in any order ("incline bench" finds "Barbell Incline Bench Press").
  // Strip characters that have meaning in PostgREST filters or LIKE patterns.
  const terms = q.toLowerCase().split(/\s+/).map((t) => t.replace(/[%_,()*\\]/g, '')).filter(Boolean).slice(0, 5)
  if (terms.length === 0) return NextResponse.json({ exercises: [] })

  let query = supabase.from('exercises').select('id, name, equipment, primary_muscles, images').limit(80)
  for (const term of terms) query = query.ilike('name', `%${term}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ exercises: [], error: 'Exercise search failed' }, { status: 500 })

  // Rank: everyday lifts first, then names that start with what was typed, then shorter (plainer) names.
  const typed = terms.join(' ')
  const rank = (name: string) => {
    const common = COMMON_LIFTS.indexOf(name)
    if (common !== -1) return common
    return COMMON_LIFTS.length + (name.toLowerCase().startsWith(typed) ? 0 : 1000)
  }
  const exercises: CatalogueExercise[] = (data ?? [])
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.length - b.name.length)
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      name: row.name,
      equipment: row.equipment,
      primaryMuscles: row.primary_muscles ?? [],
      imageUrl: exerciseImageUrl(row.images),
    }))

  return NextResponse.json({ exercises })
}
