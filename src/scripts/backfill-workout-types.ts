/**
 * Tags past workouts as Push, Pull or Legs from the exercises in them. Only workouts with no type yet are touched,
 * and only workout_types is written, so it is reversible (set it back to '{}').
 *
 *   npx tsx --env-file=.env.local src/scripts/backfill-workout-types.ts           # preview
 *   npx tsx --env-file=.env.local src/scripts/backfill-workout-types.ts --apply   # write
 */

import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
// Mixed sessions (no type has 60% of the sets) are left untagged unless asked for: a wrong pill is worse than none.
const includeMixed = process.argv.includes('--include-mixed')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  db: { schema: 'lfd' },
  auth: { autoRefreshToken: false, persistSession: false },
})

type Group = 'Push' | 'Pull' | 'Legs'

// Catalogue muscles -> training day. Abs and neck count for nothing.
const MUSCLE_GROUP: Record<string, Group> = {
  chest: 'Push', shoulders: 'Push', triceps: 'Push',
  lats: 'Pull', 'middle back': 'Pull', 'lower back': 'Pull', traps: 'Pull', biceps: 'Pull', forearms: 'Pull',
  quadriceps: 'Legs', hamstrings: 'Legs', glutes: 'Legs', calves: 'Legs', adductors: 'Legs', abductors: 'Legs',
}

// For exercises with no catalogue link: guess from the name.
function groupFromName(name: string): Group | null {
  const n = name.toLowerCase()
  if (/squat|leg press|leg curl|leg extension|lunge|deadlift|rdl|romanian|hip thrust|calf|glute|hamstring|split squat|hack/.test(n)) return 'Legs'
  if (/bench|press|dip|fly|flye|pushdown|push-up|pushup|tricep|skull|lateral raise|front raise|overhead|ohp|chest|pec/.test(n)) return 'Push'
  if (/row|pull|chin|curl|lat |pulldown|face pull|shrug|bicep|rear delt|reverse fly|hyperextension|back extension/.test(n)) return 'Pull'
  return null
}

async function main() {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, name, created_at, user_id')
    .eq('status', 'completed')
    .eq('workout_types', '{}')
    .order('created_at', { ascending: true })
  if (error) throw error

  // Page through sets (1000-row API cap), with each set's catalogue muscles.
  type SetRow = { workout_id: string; exercise_name: string; created_at: string; sort_order: number | null; exercise: { primary_muscles: string[] | null } | null }
  const sets: SetRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error: setError } = await supabase
      .from('sets')
      .select('workout_id, exercise_name, created_at, sort_order, exercise:exercises(primary_muscles)')
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (setError) throw setError
    sets.push(...((data ?? []) as unknown as SetRow[]))
    if (!data || data.length < 1000) break
  }
  const byWorkout = new Map<string, SetRow[]>()
  for (const s of sets) {
    const list = byWorkout.get(s.workout_id) ?? []
    list.push(s)
    byWorkout.set(s.workout_id, list)
  }

  const counts: Record<string, number> = {}
  const unsure: string[] = []
  const unknownNames = new Map<string, number>()
  const plan: { id: string; type: Group; mixed: boolean; date: string; name: string | null }[] = []

  for (const w of workouts ?? []) {
    const rows = (byWorkout.get(w.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at) || (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (rows.length === 0) continue

    const tally: Record<Group, number> = { Push: 0, Pull: 0, Legs: 0 }
    let first: Group | null = null
    for (const r of rows) {
      const fromMuscle = (r.exercise?.primary_muscles ?? []).map((m) => MUSCLE_GROUP[m]).find(Boolean) ?? null
      const group = fromMuscle ?? groupFromName(r.exercise_name)
      if (!group) {
        unknownNames.set(r.exercise_name, (unknownNames.get(r.exercise_name) ?? 0) + 1)
        continue
      }
      tally[group]++
      first ??= group
    }

    const total = tally.Push + tally.Pull + tally.Legs
    if (total === 0) continue
    const ranked = (Object.keys(tally) as Group[]).sort((a, b) => tally[b] - tally[a])
    // The first lift decides a tie (Push starts with chest, Pull with back).
    const top = tally[ranked[0]] === tally[ranked[1]] && first && tally[first] === tally[ranked[0]] ? first : ranked[0]
    const mixed = tally[top] / total < 0.6
    if (mixed) unsure.push(`${w.created_at.slice(0, 10)} ${w.name ?? ''}: Push ${tally.Push} / Pull ${tally.Pull} / Legs ${tally.Legs} -> ${top}`)
    plan.push({ id: w.id, type: top, mixed, date: w.created_at.slice(0, 10), name: w.name })
    if (mixed && !includeMixed) continue
    counts[top] = (counts[top] ?? 0) + 1
  }

  const toWrite = plan.filter((p) => includeMixed || !p.mixed)
  console.log(`${workouts?.length ?? 0} completed workouts without a type; ${plan.length} classified; ${toWrite.length} will be tagged`)
  console.log('Most recent 14:')
  plan.slice(-14).forEach((p) => console.log(`  ${p.date} ${(p.name ?? '').slice(0, 24).padEnd(24)} ${p.type}${p.mixed ? '  (mixed, ' + (includeMixed ? 'tagged' : 'left untagged') + ')' : ''}`))
  const byYear: Record<string, number> = {}
  plan.filter((p) => p.mixed).forEach((p) => { byYear[p.date.slice(0, 4)] = (byYear[p.date.slice(0, 4)] ?? 0) + 1 })
  console.log('Mixed sessions by year:', byYear)
  console.log('By type:', counts)
  console.log(`\nMixed sessions (under 60% one type), tagged by the biggest share or the first lift: ${unsure.length}`)
  unsure.slice(0, 15).forEach((l) => console.log('  ' + l))
  if (unknownNames.size) {
    console.log('\nExercises I could not place (ignored when counting):')
    ;[...unknownNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([n, c]) => console.log(`  ${c} × ${n}`))
  }

  if (!apply) {
    console.log('\nDry run: nothing written. Add --apply to write.')
    return
  }
  for (const group of ['Push', 'Pull', 'Legs'] as Group[]) {
    const ids = toWrite.filter((p) => p.type === group).map((p) => p.id)
    for (let i = 0; i < ids.length; i += 100) {
      const { error: updateError } = await supabase.from('workouts').update({ workout_types: [group] }).in('id', ids.slice(i, i + 100)).eq('workout_types', '{}')
      if (updateError) throw updateError
    }
    console.log(`Tagged ${ids.length} as ${group}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
