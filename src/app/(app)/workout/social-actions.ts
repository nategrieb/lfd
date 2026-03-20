'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase-server'

// ── Jork ────────────────────────────────────────────────────────────────────

export async function toggleJork(workoutId: string, workoutOwnerId: string) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('workout_jorks')
    .select('id')
    .eq('workout_id', workoutId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error: delErr } = await supabase.from('workout_jorks').delete().eq('id', existing.id)
    if (delErr) return { error: delErr.message }
    // Remove the paired jork notification
    await supabase
      .from('notifications')
      .delete()
      .eq('actor_id', user.id)
      .eq('workout_id', workoutId)
      .eq('type', 'jork')
    revalidatePath('/')
    return { jorked: false }
  } else {
    const { error: insErr } = await supabase
      .from('workout_jorks')
      .insert({ workout_id: workoutId, user_id: user.id })
    if (insErr) return { error: insErr.message }
    // Notify workout owner (not for self-jorks)
    if (workoutOwnerId !== user.id) {
      await supabase.from('notifications').insert({
        user_id:    workoutOwnerId,
        actor_id:   user.id,
        type:       'jork',
        workout_id: workoutId,
      })
    }
    revalidatePath('/')
    return { jorked: true }
  }
}

// ── Comments ─────────────────────────────────────────────────────────────────

export type CommentWithProfile = {
  id: string
  body: string
  created_at: string
  user_id: string
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null } | null
}

export async function fetchComments(workoutId: string): Promise<CommentWithProfile[]> {
  const supabase = await createServerSupabase()

  const { data: comments } = await supabase
    .from('workout_comments')
    .select('id, body, created_at, user_id')
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (!comments?.length) return []

  const userIds = [...new Set(comments.map(c => c.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  return comments.map(c => ({
    ...c,
    profiles: profileMap[c.user_id] ?? null,
  }))
}

export async function addComment(
  workoutId: string,
  workoutOwnerId: string,
  body: string,
): Promise<{ comment: CommentWithProfile } | { error: string }> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return { error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed || trimmed.length > 500) return { error: 'Invalid comment' }

  const { data: comment, error } = await supabase
    .from('workout_comments')
    .insert({ workout_id: workoutId, user_id: user.id, body: trimmed })
    .select('id, body, created_at, user_id')
    .single()

  if (error || !comment) return { error: error?.message ?? 'Failed to post comment' }

  // Fetch commenter's own profile so the UI can render the new comment inline
  const { data: ownProfile } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  // Notify workout owner (not for own workouts)
  if (workoutOwnerId !== user.id) {
    await supabase.from('notifications').insert({
      user_id:    workoutOwnerId,
      actor_id:   user.id,
      type:       'comment',
      workout_id: workoutId,
      comment_id: comment.id,
    })
  }

  revalidatePath('/')

  return { comment: { ...comment, profiles: ownProfile ?? null } }
}
