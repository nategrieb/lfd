/**
 * Imports free-exercise-db (Unlicense) into the `exercises` table, then links
 * existing sets to catalogue rows by exact (case-insensitive) exercise name.
 *
 * Run migration 20261031000001_exercise_catalogue.sql first, then:
 *   npx tsx src/scripts/import-exercise-catalogue.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Safe to re-run: rows are matched on source_id.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DATASET_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'lfd' },
  auth: { autoRefreshToken: false, persistSession: false },
})

type SourceExercise = {
  id: string
  name: string
  force: string | null
  level: string | null
  mechanic: string | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
  images: string[]
}

// Categories where reps × weight logging doesn't apply.
const NON_LIFTING_KINDS = new Set(['cardio', 'stretching'])

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  console.log('─── Exercise catalogue import ───\n')

  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`Dataset download failed: ${res.status}`)
  const source = (await res.json()) as SourceExercise[]
  console.log(`✓ Downloaded ${source.length} exercises`)

  // Existing rows: program exercises (no source_id) may already own a name or slug.
  const { data: existing, error: existingErr } = await supabase
    .from('exercises')
    .select('id, name, slug, source_id')
  if (existingErr) throw existingErr

  const bySource = new Map<string, { id: string; slug: string; name: string }>()
  const byName = new Map<string, { id: string; slug: string; name: string }>()
  const bySlug = new Set<string>()
  for (const row of existing ?? []) {
    if (row.source_id) bySource.set(row.source_id, row)
    else byName.set(row.name.toLowerCase(), row)
    bySlug.add(row.slug)
  }

  const rows = source.map((ex) => {
    // Re-runs reuse the row; otherwise adopt an unclaimed program row with the same name.
    const match = bySource.get(ex.id) ?? byName.get(ex.name.toLowerCase())
    let slug = match?.slug
    if (!slug) {
      const base = slugify(ex.name)
      slug = base
      for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`
      bySlug.add(slug)
    }
    return {
      ...(match ? { id: match.id } : {}),
      source_id: ex.id,
      name: match?.name ?? ex.name,
      slug,
      equipment: ex.equipment,
      primary_muscles: ex.primaryMuscles,
      secondary_muscles: ex.secondaryMuscles,
      force: ex.force,
      level: ex.level,
      mechanic: ex.mechanic,
      kind: ex.category,
      instructions: ex.instructions,
      images: ex.images,
      is_weightlifting: !NON_LIFTING_KINDS.has(ex.category),
    }
  })

  // Two inserts-or-updates in one: rows with an id update in place, the rest insert.
  // `category` (used by program 1RM resolution) is left untouched on updates and defaults on inserts.
  const withId = rows.filter((r) => 'id' in r)
  const withoutId = rows.filter((r) => !('id' in r))
  for (const batch of [withId, withoutId]) {
    for (let i = 0; i < batch.length; i += 200) {
      const { error } = await supabase
        .from('exercises')
        .upsert(batch.slice(i, i + 200), { onConflict: batch === withId ? 'id' : 'slug' })
      if (error) throw error
    }
  }
  console.log(`✓ Upserted ${rows.length} catalogue exercises (${withId.length} matched existing rows)`)

  // Link existing sets by exact name match.
  const { data: catalogue, error: catErr } = await supabase.from('exercises').select('id, name')
  if (catErr) throw catErr
  const idByName = new Map((catalogue ?? []).map((c) => [c.name.toLowerCase(), c.id]))

  const names = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('sets')
      .select('exercise_name')
      .is('exercise_id', null)
      .range(from, from + 999)
    if (error) throw error
    for (const row of data ?? []) names.add(row.exercise_name)
    if (!data || data.length < 1000) break
  }

  let linkedNames = 0
  for (const name of names) {
    const id = idByName.get(name.trim().toLowerCase())
    if (!id) continue
    const { error } = await supabase.from('sets').update({ exercise_id: id }).eq('exercise_name', name).is('exercise_id', null)
    if (error) throw error
    linkedNames++
  }
  console.log(`✓ Linked sets for ${linkedNames} of ${names.size} distinct exercise names`)
  console.log('  (Unmatched names stay as free text. Strong exports like "Bench Press (Barbell)" won\'t match until aliases are added.)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
