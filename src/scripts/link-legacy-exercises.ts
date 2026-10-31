/**
 * Links older sets (Strong imports, free-text names) to catalogue exercises using
 * LEGACY_EXERCISE_MAP. Only sets.exercise_id is written; exercise_name is untouched,
 * so this is reversible (set exercise_id back to NULL).
 *
 *   npx tsx --env-file=.env.local src/scripts/link-legacy-exercises.ts --dry   # preview
 *   npx tsx --env-file=.env.local src/scripts/link-legacy-exercises.ts         # apply
 */

import { createClient } from '@supabase/supabase-js'
import { resolveLegacyName, LEGACY_EXERCISE_MAP } from '../lib/legacy-exercise-map'

const dry = process.argv.includes('--dry')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  db: { schema: 'lfd' },
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: catalogue, error: catErr } = await supabase.from('exercises').select('id, name')
  if (catErr) throw catErr
  const idByName = new Map((catalogue ?? []).map((c) => [c.name, c.id]))

  const missing = [...new Set(Object.values(LEGACY_EXERCISE_MAP))].filter((n) => !idByName.has(n))
  if (missing.length) {
    console.error('Mapping targets not found in the catalogue:\n  ' + missing.join('\n  '))
    process.exit(1)
  }

  const counts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('sets').select('exercise_name').is('exercise_id', null).range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) counts.set(r.exercise_name, (counts.get(r.exercise_name) ?? 0) + 1)
    if (!data || data.length < 1000) break
  }

  let linkedSets = 0
  let leftSets = 0
  const left: [string, number][] = []
  for (const [name, count] of counts) {
    const target = resolveLegacyName(name)
    if (!target) {
      leftSets += count
      left.push([name, count])
      continue
    }
    linkedSets += count
    console.log(`${dry ? '[dry] ' : ''}${String(count).padStart(4)} × ${name}  →  ${target}`)
    if (!dry) {
      const { error } = await supabase
        .from('sets')
        .update({ exercise_id: idByName.get(target)! })
        .eq('exercise_name', name)
        .is('exercise_id', null)
      if (error) throw error
    }
  }

  console.log(`\n${dry ? 'Would link' : 'Linked'} ${linkedSets} sets. ${leftSets} sets across ${left.length} names stay as free text:`)
  for (const [name, count] of left.sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(4)} × ${name}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
