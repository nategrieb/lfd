'use server'

import { revalidatePath } from 'next/cache'
import Papa from 'papaparse'
import { createServerSupabase } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StrongRow = {
  Date: string
  'Workout Name': string
  Duration: string
  'Exercise Name': string
  'Set Order': string
  Weight: string
  Reps: string
  Distance: string
  Seconds: string
  Notes: string
  'Workout Notes': string
  RPE: string
}

export type ImportResult = {
  success: boolean
  message: string
  importedWorkouts?: number
  importedSets?: number
  skippedWorkouts?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS: (keyof StrongRow)[] = [
  'Date',
  'Workout Name',
  'Duration',
  'Exercise Name',
  'Set Order',
  'Weight',
  'Reps',
]

/**
 * Parse Strong-style duration strings to total seconds.
 * Handles: "46m", "1h", "22h 20m", "1h 5m 30s"
 */
function parseDurationToSeconds(raw: string): number | null {
  if (!raw?.trim()) return null
  const h = Number(raw.match(/(\d+)\s*h/)?.[1] ?? 0)
  const m = Number(raw.match(/(\d+)\s*m(?!s)/)?.[1] ?? 0)
  const s = Number(raw.match(/(\d+)\s*s/)?.[1] ?? 0)
  const total = h * 3600 + m * 60 + s
  return total > 0 ? total : null
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function importStrongCSV(
  _prevState: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return { success: false, message: 'Not authenticated.' }
  }

  // ── Validate file ────────────────────────────────────────────────────────
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { success: false, message: 'No file provided.' }
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return { success: false, message: 'File must be a CSV (.csv).' }
  }

  // ── Parse CSV ────────────────────────────────────────────────────────────
  const csvText = await file.text()
  const { data: rows, errors, meta } = Papa.parse<StrongRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (errors.length > 0 && rows.length === 0) {
    return { success: false, message: `Failed to parse CSV: ${errors[0].message}` }
  }

  const missingHeaders = REQUIRED_HEADERS.filter(h => !meta.fields?.includes(h))
  if (missingHeaders.length > 0) {
    return {
      success: false,
      message: `Missing required columns: ${missingHeaders.join(', ')}. Make sure you exported from the Strong app.`,
    }
  }

  // ── Group rows by (Date, Workout Name) ─────────────────────────────────
  const workoutMap = new Map<string, StrongRow[]>()
  for (const row of rows) {
    const key = `${row.Date}|||${row['Workout Name']}`
    if (!workoutMap.has(key)) workoutMap.set(key, [])
    workoutMap.get(key)!.push(row)
  }

  // ── Fetch existing Strong imports to detect duplicates ──────────────────
  const { data: existingWorkouts } = await supabase
    .from('workouts')
    .select('name, created_at')
    .eq('user_id', user.id)
    .eq('source', 'strong')

  const existingSet = new Set(
    (existingWorkouts ?? []).map(
      w => `${w.name}|||${new Date(w.created_at).toISOString().substring(0, 10)}`,
    ),
  )

  // ── Import workouts ──────────────────────────────────────────────────────
  let importedWorkouts = 0
  let importedSets = 0
  let skippedWorkouts = 0

  for (const [key, workoutRows] of workoutMap) {
    const [dateStr, workoutName] = key.split('|||')

    const workoutDate = new Date(dateStr)
    if (isNaN(workoutDate.getTime())) {
      skippedWorkouts++
      continue
    }

    // Skip duplicates
    const dateKey = workoutDate.toISOString().substring(0, 10)
    if (existingSet.has(`${workoutName}|||${dateKey}`)) {
      skippedWorkouts++
      continue
    }

    // Insert workout row
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        name: workoutName,
        status: 'completed',
        source: 'strong',
        duration_seconds: parseDurationToSeconds(workoutRows[0].Duration),
        created_at: workoutDate.toISOString(),
      })
      .select('id')
      .single()

    if (workoutError || !workout) continue

    // Build and insert sets
    const setsToInsert = workoutRows
      .filter(row => row['Exercise Name']?.trim())
      .map((row, i) => ({
        workout_id: workout.id,
        user_id: user.id,
        exercise_name: row['Exercise Name'].trim(),
        weight: row.Weight !== '' ? Number(row.Weight) : 0,
        reps: row.Reps !== '' ? Number(row.Reps) : 0,
        rpe: row.RPE !== '' && row.RPE != null ? Number(row.RPE) : null,
        set_order: row['Set Order'] !== '' ? Number(row['Set Order']) : i + 1,
      }))

    if (setsToInsert.length === 0) {
      importedWorkouts++
      continue
    }

    const { error: setsError } = await supabase.from('sets').insert(setsToInsert)

    if (setsError) {
      // Roll back: remove the orphaned workout
      await supabase.from('workouts').delete().eq('id', workout.id).eq('user_id', user.id)
    } else {
      importedWorkouts++
      importedSets += setsToInsert.length
    }
  }

  revalidatePath('/history')

  const skippedNote =
    skippedWorkouts > 0
      ? ` Skipped ${skippedWorkouts} duplicate${skippedWorkouts !== 1 ? 's' : ''}.`
      : ''

  return {
    success: true,
    message: `Imported ${importedWorkouts} workout${importedWorkouts !== 1 ? 's' : ''} (${importedSets} set${importedSets !== 1 ? 's' : ''}).${skippedNote}`,
    importedWorkouts,
    importedSets,
    skippedWorkouts,
  }
}
