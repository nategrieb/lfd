'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'
import { getCalculatedWeight, resolveExerciseMax } from '@/lib/programs'

export async function enrollInProgram(formData: FormData) {
  const templateId  = String(formData.get('template_id'))
  const startDateStr = String(formData.get('start_date'))
  const squatMax    = Number(formData.get('squat_max'))
  const benchMax    = Number(formData.get('bench_max'))
  const deadliftMax = Number(formData.get('deadlift_max'))

  if (!templateId || !startDateStr || !squatMax || !benchMax || !deadliftMax) {
    return { success: false, message: 'All fields are required.' }
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { success: false, message: 'Not authenticated.' }

  // Fetch template + all its workouts and set prescriptions in one shot
  const { data: tmpl } = await supabase
    .from('program_templates')
    .select(`
      id, duration_weeks,
      template_workouts (
        id, week_number, day_number, name,
        template_sets (
          id, sort_order, exercise_name, sets_count, reps, reps_note,
          percentage, target_rpe, tempo, rest_seconds
        )
      )
    `)
    .eq('id', templateId)
    .single()

  if (!tmpl) return { success: false, message: 'Program template not found.' }

  const startDate = new Date(startDateStr)
  const endDate   = new Date(startDate)
  endDate.setDate(endDate.getDate() + tmpl.duration_weeks * 7)

  // Delete any existing enrollments for this template (active or cancelled).
  // This removes stale rows so re-enrolling with the same start date never
  // hits the unique constraint on (user_id, template_id, start_date).
  const { data: existingEnrollments } = await supabase
    .from('program_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('template_id', templateId)

  if (existingEnrollments?.length) {
    const ids = existingEnrollments.map(e => e.id)
    // Delete scheduled_workouts (and their scheduled_sets via CASCADE) first
    await supabase
      .from('scheduled_workouts')
      .delete()
      .in('enrollment_id', ids)
      .eq('user_id', user.id)
    await supabase
      .from('program_enrollments')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
  }

  const { data: enrollment, error: enrollErr } = await supabase
    .from('program_enrollments')
    .insert({
      user_id:      user.id,
      template_id:  templateId,
      squat_max:    squatMax,
      bench_max:    benchMax,
      deadlift_max: deadliftMax,
      start_date:   startDate.toISOString().slice(0, 10),
      end_date:     endDate.toISOString().slice(0, 10),
      status:       'active',
    })
    .select('id')
    .single()

  if (enrollErr || !enrollment) {
    return { success: false, message: enrollErr?.message ?? 'Failed to enroll.' }
  }

  // Build scheduled_workouts + scheduled_sets
  const templateWorkouts = (tmpl.template_workouts ?? []) as any[]

  for (const tw of templateWorkouts) {
    const offsetDays = (tw.week_number - 1) * 7 + (tw.day_number - 1)
    const scheduledDate = new Date(startDate)
    scheduledDate.setDate(scheduledDate.getDate() + offsetDays)

    const { data: sw, error: swErr } = await supabase
      .from('scheduled_workouts')
      .insert({
        user_id:             user.id,
        enrollment_id:       enrollment.id,
        template_workout_id: tw.id,
        scheduled_date:      scheduledDate.toISOString().slice(0, 10),
        status:              'planned',
      })
      .select('id')
      .single()

    if (swErr || !sw) continue

    // Pre-calculate sets for this scheduled workout
    const sets = ((tw.template_sets ?? []) as any[])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((ts: any) => {
        // Resolve the correct 1RM for this exercise
        const userMax = resolveExerciseMax(ts.exercise_name, squatMax, benchMax, deadliftMax)
        const calculatedWeight =
          ts.percentage && userMax
            ? getCalculatedWeight(userMax, ts.percentage)
            : null  // RPE-based → user fills in live

        return {
          scheduled_workout_id: sw.id,
          template_set_id:      ts.id,
          sort_order:           ts.sort_order,
          exercise_name:        ts.exercise_name,
          sets_count:           ts.sets_count,
          reps:                 ts.reps ?? null,
          reps_note:            ts.reps_note ?? null,
          calculated_weight:    calculatedWeight,
          percentage:           ts.percentage ?? null,
          target_rpe:           ts.target_rpe ?? null,
          tempo:                ts.tempo ?? null,
          rest_seconds:         ts.rest_seconds ?? null,
        }
      })

    if (sets.length) {
      await supabase.from('scheduled_sets').insert(sets)
    }
  }

  revalidatePath('/history')
  revalidatePath('/programs')
  redirect(`/programs/${templateId}?enrolled=1`)
}

/**
 * Unenroll from a program: delete all future planned workouts and the enrollment row itself.
 */
export async function unenrollFromProgram(enrollmentId: string, templateId: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { success: false, message: 'Not authenticated.' }

  // Delete all planned scheduled_workouts (and their sets via CASCADE if configured,
  // otherwise the FK on scheduled_sets will handle it)
  await supabase
    .from('scheduled_workouts')
    .delete()
    .eq('enrollment_id', enrollmentId)
    .eq('user_id', user.id)
    .eq('status', 'planned')

  // Delete the enrollment row entirely so re-enrolling never hits the unique constraint
  const { error } = await supabase
    .from('program_enrollments')
    .delete()
    .eq('id', enrollmentId)
    .eq('user_id', user.id)

  if (error) return { success: false, message: error.message }

  revalidatePath('/history')
  revalidatePath(`/programs/${templateId}`)
  redirect(`/programs/${templateId}`)
}

